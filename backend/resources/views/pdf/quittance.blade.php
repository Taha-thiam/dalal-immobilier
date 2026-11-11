<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Quittance {{ $quittance->numero }}</title>
<style>
    @page { margin: 22mm 20mm; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 10.5pt; color: #1f2937; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; }
    .agence { font-size: 15pt; font-weight: bold; color: #0f172a; }
    .agence span { color: #0e7490; }
    .petit { font-size: 8.5pt; color: #64748b; }
    h1 { font-size: 17pt; text-align: center; margin: 22px 0 2px; letter-spacing: 2px; color: #0f172a; }
    .periode { text-align: center; font-size: 11pt; color: #0e7490; font-weight: bold; margin-bottom: 20px; }
    .cadre { border: 1px solid #cbd5e1; padding: 10px 12px; vertical-align: top; }
    .titre-cadre { font-size: 8.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .montant-total { border: 2px solid #0e7490; padding: 14px; text-align: center; margin: 20px 0; }
    .montant-total .chiffre { font-size: 20pt; font-weight: bold; color: #0e7490; }
    .detail td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
    .detail td.droite { text-align: right; }
    .detail tr.total td { font-weight: bold; border-top: 1.5px solid #0f172a; border-bottom: none; }
    .mention { font-size: 9.5pt; text-align: justify; margin-top: 16px; }
    .signature { margin-top: 28px; width: 45%; margin-left: 55%; text-align: center; }
    .zone { height: 60px; border: 1px dashed #94a3b8; margin-top: 6px; }
    .pied { position: fixed; bottom: -10mm; left: 0; right: 0; text-align: center; font-size: 8pt; color: #94a3b8; }
</style>
</head>
<body>

@php
    $fcfa = fn ($v) => number_format((float) $v, 0, ',', ' ') . ' FCFA';
    $echeance = $quittance->paiement->echeance;
    $bail = $echeance->bail;
    $locataire = $bail->locataire->user;
    $proprio = $bail->bien->proprietaire->user;
    $loyer = (float) $bail->loyer_mensuel;
    $charges = (float) $bail->charges;
@endphp

<div class="pied">
    {{ $agence->nom_agence ?? 'Dalal Immobilier' }} — Quittance n° {{ $quittance->numero }} — Bail {{ $bail->numero }}
</div>

<!-- En-tête -->
<table>
    <tr>
        <td>
            <div class="agence">Dalal <span>Immobilier</span></div>
            <div class="petit">{{ $agence->adresse ?? '' }}<br>Tél. : {{ $agence->telephone ?? '' }}</div>
        </td>
        <td style="text-align: right;">
            <div class="petit">Quittance n°</div>
            <div style="font-size: 12pt; font-weight: bold;">{{ $quittance->numero }}</div>
            <div class="petit">Émise le {{ $quittance->date_emission->format('d/m/Y') }}</div>
        </td>
    </tr>
</table>

<h1>QUITTANCE DE LOYER</h1>
<div class="periode">Période : {{ ucfirst($echeance->mois->locale('fr')->translatedFormat('F Y')) }}</div>

<!-- Parties -->
<table>
    <tr>
        <td class="cadre" style="width: 50%;">
            <div class="titre-cadre">Bailleur</div>
            <strong>{{ $proprio->prenom }} {{ $proprio->nom }}</strong><br>
            <span class="petit">représenté par {{ $agence->nom_agence ?? 'Dalal Immobilier' }}</span>
        </td>
        <td style="width: 12px;"></td>
        <td class="cadre" style="width: 50%;">
            <div class="titre-cadre">Locataire</div>
            <strong>{{ $locataire->prenom }} {{ $locataire->nom }}</strong><br>
            <span class="petit">{{ $bail->bien->titre }}<br>{{ $bail->bien->adresse }}, {{ $bail->bien->quartier }}</span>
        </td>
    </tr>
</table>

<!-- Montant -->
<div class="montant-total">
    <div class="petit">Somme reçue pour la période</div>
    <div class="chiffre">{{ $fcfa($echeance->montant_du) }}</div>
</div>

<table class="detail">
    <tr><td>Loyer</td><td class="droite">{{ $fcfa($loyer) }}</td></tr>
    @if ($charges > 0)
        <tr><td>Charges</td><td class="droite">{{ $fcfa($charges) }}</td></tr>
    @endif
    <tr class="total"><td>Total réglé</td><td class="droite">{{ $fcfa($echeance->montant_du) }}</td></tr>
</table>

<!-- Paiements reçus pour ce mois -->
<p style="margin: 16px 0 6px; font-weight: bold;">Règlement(s) reçu(s)</p>
<table class="detail">
    @foreach ($paiements as $p)
        <tr>
            <td>{{ $p->date_paiement->format('d/m/Y') }}</td>
            <td>{{ ['especes' => 'Espèces', 'wave' => 'Wave', 'orange_money' => 'Orange Money', 'virement' => 'Virement'][$p->mode_paiement] ?? $p->mode_paiement }}</td>
            <td>{{ $p->reference ?? '—' }}</td>
            <td class="droite">{{ $fcfa($p->montant) }}</td>
        </tr>
    @endforeach
</table>

<p class="mention">
    Le bailleur, représenté par son mandataire, reconnaît avoir reçu de {{ $locataire->prenom }} {{ $locataire->nom }}
    la somme de <strong>{{ $fcfa($echeance->montant_du) }}</strong> au titre du loyer et des charges de la période indiquée,
    pour le logement désigné ci-dessus (bail n° {{ $bail->numero }}), et lui en donne quittance, sous réserve de tous ses droits.
</p>

<div class="signature">
    Fait à Dakar, le {{ $quittance->date_emission->format('d/m/Y') }}<br>
    Pour {{ $agence->nom_agence ?? 'Dalal Immobilier' }}
    <div class="zone"></div>
</div>

</body>
</html>