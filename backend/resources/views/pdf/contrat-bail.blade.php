<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Contrat de bail {{ $bail->numero }}</title>
<style>
    @page { margin: 28mm 20mm 22mm 20mm; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 10.5pt; color: #1f2937; line-height: 1.5; }
    h1 { font-size: 15pt; text-align: center; margin: 0 0 4px; letter-spacing: 1px; color: #0f172a; }
    .sous-titre { text-align: center; color: #64748b; font-size: 9.5pt; margin-bottom: 18px; }
    h2 { font-size: 11pt; color: #0e7490; border-bottom: 1.5px solid #0e7490; padding-bottom: 3px; margin: 18px 0 8px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    .entete td { vertical-align: top; }
    .agence { font-size: 15pt; font-weight: bold; color: #0f172a; }
    .agence span { color: #0e7490; }
    .petit { font-size: 8.5pt; color: #64748b; }
    .cadre { border: 1px solid #cbd5e1; padding: 10px 12px; }
    .infos td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; }
    .infos td.libelle { width: 42%; color: #64748b; }
    .montant { font-weight: bold; color: #0f172a; }
    p { margin: 0 0 7px; text-align: justify; }
    .signatures td { width: 50%; vertical-align: top; padding-top: 10px; }
    .zone-signature { height: 70px; border: 1px dashed #94a3b8; margin-top: 6px; }
    .pied { position: fixed; bottom: -12mm; left: 0; right: 0; text-align: center; font-size: 8pt; color: #94a3b8; }
</style>
</head>
<body>

@php
    $fcfa = fn ($v) => number_format((float) $v, 0, ',', ' ') . ' FCFA';
    $proprio = $bail->bien->proprietaire->user;
    $locataire = $bail->locataire->user;
@endphp

<div class="pied">
    {{ $agence->nom_agence ?? 'Dalal Immobilier' }} — Contrat n° {{ $bail->numero }} — Généré le {{ $dateGeneration }}
</div>

<!-- En-tête de l'agence -->
<table class="entete">
    <tr>
        <td>
            <div class="agence">Dalal <span>Immobilier</span></div>
            <div class="petit">{{ $agence->adresse ?? '' }}<br>Tél. : {{ $agence->telephone ?? '' }}</div>
        </td>
        <td style="text-align: right;">
            <div class="petit">Contrat n°</div>
            <div style="font-size: 12pt; font-weight: bold;">{{ $bail->numero }}</div>
        </td>
    </tr>
</table>

<div style="height: 18px;"></div>
<h1>CONTRAT DE BAIL {{ $bail->type_bail === 'professionnel' ? 'À USAGE PROFESSIONNEL' : 'À USAGE D\'HABITATION' }}</h1>
<div class="sous-titre">Établi par {{ $agence->nom_agence ?? 'Dalal Immobilier' }}, mandataire du bailleur</div>

<h2>Article 1 — Les parties</h2>
<table>
    <tr>
        <td style="width: 50%; padding-right: 6px; vertical-align: top;">
            <div class="cadre">
                <strong>LE BAILLEUR</strong><br>
                {{ $proprio->prenom }} {{ $proprio->nom }}<br>
                @if ($bail->bien->proprietaire->numero_cni) CNI n° {{ $bail->bien->proprietaire->numero_cni }}<br> @endif
                @if ($bail->bien->proprietaire->adresse) {{ $bail->bien->proprietaire->adresse }}<br> @endif
                <span class="petit">Représenté par {{ $agence->nom_agence ?? 'Dalal Immobilier' }}, en vertu d'un mandat de gestion.</span>
            </div>
        </td>
        <td style="width: 50%; padding-left: 6px; vertical-align: top;">
            <div class="cadre">
                <strong>LE PRENEUR</strong><br>
                {{ $locataire->prenom }} {{ $locataire->nom }}<br>
                @if ($bail->locataire->numero_cni) CNI n° {{ $bail->locataire->numero_cni }}<br> @endif
                @if ($bail->locataire->profession) Profession : {{ $bail->locataire->profession }}<br> @endif
                @if ($locataire->telephone) Tél. : {{ $locataire->telephone }} @endif
            </div>
        </td>
    </tr>
</table>

<h2>Article 2 — Désignation du bien</h2>
<table class="infos">
    <tr><td class="libelle">Référence</td><td>{{ $bail->bien->reference }}</td></tr>
    <tr><td class="libelle">Désignation</td><td>{{ $bail->bien->titre }} ({{ ucfirst($bail->bien->type) }})</td></tr>
    <tr><td class="libelle">Adresse</td><td>{{ $bail->bien->adresse }}, {{ $bail->bien->quartier }}</td></tr>
    @if ($bail->bien->surface)<tr><td class="libelle">Surface</td><td>{{ (float) $bail->bien->surface }} m²</td></tr>@endif
    @if ($bail->bien->nb_pieces)<tr><td class="libelle">Nombre de pièces</td><td>{{ $bail->bien->nb_pieces }}</td></tr>@endif
</table>

<h2>Article 3 — Durée</h2>
<p>
    Le présent bail est consenti pour une durée allant du <strong>{{ $bail->date_debut->format('d/m/Y') }}</strong>
    au <strong>{{ $bail->date_fin->format('d/m/Y') }}</strong>.
    @if ($bail->renouvellement_tacite)
        À son terme, il se renouvellera par tacite reconduction pour une durée identique, sauf congé donné par l'une des parties.
    @else
        Il prendra fin à son terme sans tacite reconduction ; son renouvellement fera l'objet d'un nouveau contrat.
    @endif
</p>
<p>Chacune des parties peut y mettre fin moyennant un préavis de <strong>{{ $bail->preavis_mois }} mois</strong>, notifié par écrit.</p>

<h2>Article 4 — Conditions financières</h2>
<table class="infos">
    <tr><td class="libelle">Loyer mensuel</td><td class="montant">{{ $fcfa($bail->loyer_mensuel) }}</td></tr>
    @if ((float) $bail->charges > 0)<tr><td class="libelle">Charges mensuelles</td><td class="montant">{{ $fcfa($bail->charges) }}</td></tr>@endif
    <tr><td class="libelle">Total mensuel</td><td class="montant">{{ $fcfa((float) $bail->loyer_mensuel + (float) $bail->charges) }}</td></tr>
    <tr><td class="libelle">Dépôt de garantie (caution)</td><td class="montant">{{ $fcfa($caution) }}</td></tr>
    @if ((float) $bail->avance > 0)<tr><td class="libelle">Avance sur loyer</td><td class="montant">{{ $fcfa($bail->avance) }}</td></tr>@endif
    <tr><td class="libelle">Échéance de paiement</td><td>Au plus tard le <strong>{{ $bail->jour_echeance }}</strong> de chaque mois</td></tr>
</table>
<p style="margin-top: 8px;">
    Le loyer est payable à l'agence en espèces, par virement ou par paiement mobile (Wave, Orange Money).
    Une quittance est délivrée après chaque paiement intégral. Le dépôt de garantie sera restitué en fin de bail,
    déduction faite des sommes dues et du coût des réparations constatées lors de l'état des lieux de sortie.
</p>

<h2>Article 5 — Obligations des parties</h2>
<p>Le preneur s'engage à occuper les lieux paisiblement, à les entretenir, à ne pas les sous-louer sans accord écrit du bailleur, et à signaler sans délai à l'agence tout dérangement ou dégât.</p>
<p>Le bailleur s'engage à délivrer un logement en bon état d'usage et à assurer les grosses réparations ne résultant pas du fait du preneur.</p>
<p>Un état des lieux contradictoire sera établi à la sortie du preneur.</p>

@if ($bail->clauses)
<h2>Article 6 — Clauses particulières</h2>
<p style="white-space: pre-line;">{{ $bail->clauses }}</p>
@endif

<h2>Signatures</h2>
<p>Fait à Dakar, le {{ $bail->created_at->format('d/m/Y') }}, en deux exemplaires originaux.</p>
<table class="signatures">
    <tr>
        <td style="padding-right: 10px;">
            Pour le bailleur, {{ $agence->nom_agence ?? 'Dalal Immobilier' }}<br>
            <span class="petit">Lu et approuvé</span>
            <div class="zone-signature"></div>
        </td>
        <td style="padding-left: 10px;">
            Le preneur, {{ $locataire->prenom }} {{ $locataire->nom }}<br>
            <span class="petit">Lu et approuvé</span>
            <div class="zone-signature"></div>
        </td>
    </tr>
</table>

</body>
</html>