<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DemandeLocation;
use App\Models\MessageContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class DemandeController extends Controller
{
    // =====================================================================
    // DEMANDES DE LOCATION
    // =====================================================================

    /** GET /demandes : les nouvelles d'abord */
    public function index(Request $request): JsonResponse
    {
        $requete = DemandeLocation::with('bien')
            ->orderByRaw("CASE statut WHEN 'nouvelle' THEN 0 WHEN 'en_cours' THEN 1 ELSE 2 END")
            ->orderByDesc('id');

        if ($statut = $request->query('statut')) {
            $statut === 'ouvertes'
                ? $requete->whereIn('statut', [DemandeLocation::NOUVELLE, DemandeLocation::EN_COURS])
                : $requete->where('statut', $statut);
        }

        if ($texte = trim((string) $request->query('recherche', ''))) {
            $motif = "%{$texte}%";
            $requete->where(function ($q) use ($motif) {
                $q->where('numero', 'ilike', $motif)
                    ->orWhere('nom', 'ilike', $motif)
                    ->orWhere('prenom', 'ilike', $motif)
                    ->orWhere('telephone', 'ilike', $motif)
                    ->orWhereHas('bien', fn($b) => $b->where('titre', 'ilike', $motif)->orWhere('reference', 'ilike', $motif));
            });
        }

        return response()->json(
            $requete->paginate(15)->through(fn(DemandeLocation $d) => $this->format($d))
        );
    }

    /** GET /demandes/compteur : pour la pastille rouge du menu */
    public function compteur(): JsonResponse
    {
        return response()->json([
            'demandes' => DemandeLocation::where('statut', DemandeLocation::NOUVELLE)->count(),
            'messages' => MessageContact::where('lu', false)->count(),
        ]);
    }

    /** PATCH /demandes/{demande}/visite : on a appelé, une visite est prévue */
    public function planifierVisite(Request $request, DemandeLocation $demande): JsonResponse
    {
        $this->verifierOuverte($demande);

        $donnees = $request->validate([
            'date_visite' => ['required', 'date', 'after_or_equal:today'],
            'note_interne' => ['nullable', 'string', 'max:2000'],
        ], ['date_visite.after_or_equal' => 'La visite ne peut pas être dans le passé.']);

        $demande->update($donnees + [
            'statut' => DemandeLocation::EN_COURS,
            'traite_par' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Visite planifiée le ' . $demande->date_visite->format('d/m/Y à H:i') . '.',
            'demande' => $this->format($demande->fresh('bien')),
        ]);
    }

    /** PATCH /demandes/{demande}/acceptation */
    public function accepter(Request $request, DemandeLocation $demande): JsonResponse
    {
        $this->verifierOuverte($demande);

        $donnees = $request->validate(['note_interne' => ['nullable', 'string', 'max:2000']]);

        $demande->update([
            'statut' => DemandeLocation::ACCEPTEE,
            'note_interne' => $donnees['note_interne'] ?? $demande->note_interne,
            'traite_par' => $request->user()->id,
        ]);

        // Les autres demandes ouvertes pour le même bien : utile pour prévenir les autres candidats
        $autres = DemandeLocation::where('bien_id', $demande->bien_id)
            ->where('id', '!=', $demande->id)
            ->whereIn('statut', [DemandeLocation::NOUVELLE, DemandeLocation::EN_COURS])
            ->count();

        return response()->json([
            'message' => "Demande {$demande->numero} acceptée. Étape suivante : créer le locataire puis le bail."
                . ($autres > 0 ? " ⚠ {$autres} autre(s) demande(s) en attente pour ce bien." : ''),
            'demande' => $this->format($demande->fresh('bien')),
        ]);
    }

    /** PATCH /demandes/{demande}/refus */
    public function refuser(Request $request, DemandeLocation $demande): JsonResponse
    {
        $this->verifierOuverte($demande);

        $donnees = $request->validate([
            'motif_refus' => ['required', 'string', 'min:5', 'max:1000'],
        ], ['motif_refus.min' => 'Le motif doit contenir au moins 5 caractères.']);

        $demande->update($donnees + [
            'statut' => DemandeLocation::REFUSEE,
            'traite_par' => $request->user()->id,
        ]);

        return response()->json([
            'message' => "Demande {$demande->numero} refusée.",
            'demande' => $this->format($demande->fresh('bien')),
        ]);
    }

    // =====================================================================
    // MESSAGES DE CONTACT
    // =====================================================================

    /** GET /messages-contact */
    public function messages(Request $request): JsonResponse
    {
        $requete = MessageContact::orderBy('lu')->orderByDesc('id');

        if ($request->query('non_lus')) {
            $requete->where('lu', false);
        }

        return response()->json($requete->paginate(15));
    }

    /** PATCH /messages-contact/{message}/lu */
    public function marquerLu(MessageContact $message): JsonResponse
    {
        $message->update(['lu' => true]);

        return response()->json(['message' => 'Message marqué comme lu.']);
    }

    // ---------------------------------------------------------------------

    private function verifierOuverte(DemandeLocation $demande): void
    {
        if (!$demande->estOuverte()) {
            throw ValidationException::withMessages(['statut' => 'Cette demande est déjà traitée.']);
        }
    }

    private function format(DemandeLocation $d): array
    {
        return array_merge($d->toArray(), [
            'bien' => $d->bien ? [
                'id' => $d->bien->id,
                'titre' => $d->bien->titre,
                'reference' => $d->bien->reference,
                'quartier' => $d->bien->quartier,
                'statut' => $d->bien->statut,
            ] : null,
        ]);
    }
}