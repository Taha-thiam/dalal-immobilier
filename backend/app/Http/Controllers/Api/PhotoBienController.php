<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bien;
use App\Models\PhotoBien;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PhotoBienController extends Controller
{
    /** Nombre maximum de photos par bien */
    private const MAX_PHOTOS = 15;

    /**
     * Envoi d'une ou plusieurs photos.
     * POST /api/biens/{bien}/photos   (form-data : photos[] = fichiers)
     */
    public function store(Request $request, Bien $bien): JsonResponse
    {
        $request->validate([
            'photos' => ['required', 'array', 'min:1', 'max:10'],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:4096'], // 4 Mo par photo
        ], [
            'photos.required' => 'Sélectionnez au moins une photo.',
            'photos.max' => '10 photos maximum par envoi.',
            'photos.*.image' => 'Chaque fichier doit être une image.',
            'photos.*.mimes' => 'Formats acceptés : JPG, PNG, WEBP.',
            'photos.*.max' => 'Chaque photo doit faire 4 Mo maximum.',
        ]);

        $existantes = $bien->photos()->reorder()->count();
        $nouvelles = count($request->file('photos'));

        if ($existantes + $nouvelles > self::MAX_PHOTOS) {
            return response()->json([
                'message' => 'Un bien peut avoir ' . self::MAX_PHOTOS . ' photos au maximum (actuellement : ' . $existantes . ').',
            ], 422);
        }

        $ordre = (int) $bien->photos()->reorder()->max('ordre');

        foreach ($request->file('photos') as $fichier) {
            $chemin = $fichier->store("biens/{$bien->id}", 'public');
            $bien->photos()->create([
                'url' => $chemin,
                'ordre' => $existantes === 0 && $ordre === 0 ? $ordre : ++$ordre,
            ]);
            $existantes++;
        }

        return response()->json([
            'message' => $nouvelles . ' photo(s) ajoutée(s).',
            'photos' => $this->liste($bien),
        ], 201);
    }

    /**
     * Définir une photo comme photo principale (celle de l'annonce).
     * PATCH /api/biens/{bien}/photos/{photo}/principale
     */
    public function principale(Bien $bien, PhotoBien $photo): JsonResponse
    {
        abort_unless($photo->bien_id === $bien->id, 404);

        DB::transaction(function () use ($bien, $photo) {
            $bien->photos()->reorder()->increment('ordre');   // décale toutes les photos
            $photo->update(['ordre' => 0]);         // celle-ci passe en premier
        });

        return response()->json([
            'message' => 'Photo principale modifiée.',
            'photos' => $this->liste($bien),
        ]);
    }

    /**
     * Suppression d'une photo (fichier + base).
     * DELETE /api/biens/{bien}/photos/{photo}
     */
    public function destroy(Bien $bien, PhotoBien $photo): JsonResponse
    {
        abort_unless($photo->bien_id === $bien->id, 404);

        Storage::disk('public')->delete($photo->url);
        $photo->delete();

        // Plus aucune photo : le bien ne peut plus rester publié
        $retire = false;
        if ($bien->publie && ! $bien->photos()->exists()) {
            $bien->update(['publie' => false]);
            $retire = true;
        }

        return response()->json([
            'message' => $retire
                ? 'Photo supprimée. Le bien n’a plus de photo : il a été retiré du site.'
                : 'Photo supprimée.',
            'photos' => $this->liste($bien),
        ]);
    }

    /** Photos du bien, dans l'ordre, avec leur adresse complète */
    private function liste(Bien $bien): array
    {
        return $bien->photos()->get()->map(fn ($p) => [
            'id' => $p->id,
            'url' => str_starts_with($p->url, 'http') ? $p->url : asset('storage/' . $p->url),
            'ordre' => $p->ordre,
        ])->all();
    }
}