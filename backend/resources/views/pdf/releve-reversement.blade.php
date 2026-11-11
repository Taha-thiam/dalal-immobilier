<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Relevé {{ $reversement->numero }}</title>
<style>
    @page { margin: 28px 32px; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 10.5px; color: #1e293b; }
    .entete { border-bottom: 3px solid #00b8d9; padding-bottom: 10px; }
    .entete table { width: 100%; }
    .agence { font-size: 20px; font-weight: bold; color: #0a0a0f; }
    .agence span { color: #00b8d9; }
    .slogan { color: #ff2e5b; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; }
    .titre { text-align: right; }
    .titre h1 { margin: 0; font-size: 16px; color: #0a0a0f; }
    .titre p { margin: 2px 0; color: #64748b; }
    .bloc { margin-top: 16px; width: 100%; }
    .bloc td { vertical-align: top; width: 50%; }
    .label { color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; }
    .detail { width: 100%; border-collapse: collapse; margin-top: 18px; }
    .detail th { background: #0a0a0f; color: #fff; padding: 7px 6px; text-align: left; font-size: 9px; text-transform: uppercase; }
    .detail td { padding: 7px 6px; border-bottom: 1px solid #e2e8f0; }
    .detail tr:nth-child(even) td { background: #f8fafc; }
    .num { text-align: right; white-space: nowrap; }
    .totaux { width: 46%; margin-left: 54%; margin-top: 14px; border-collapse: collapse; }
    .totaux td { padding: 6px 8px; }
    .totaux .com td { color: #ff2e5b; }
    .totaux .net td { background: #0a0a0f; color: #fff; font-size: 13px; font-weight: bold; }
    .statut { display: inline-block; padding: 3px 10px; border-radius: 10px; font-weight: bold; font-size: 9px; }
    .paye { background: #d1fae5; color: #047857; }
    .apayer { background: #fef3c7; color: #b45309; }
    .pied { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; }
</style>
</head>
<body>

@php
    $fcfa = fn ($v) => number_format((float) $v, 0, ',', ' ') . ' FCFA';
    $date = fn ($v) => $v ? \Carbon\Carbon::parse($v)->format('d/m/Y') : '—';
    $mois = fn ($v) => $v ? ucfirst(\Carbon\Carbon::parse($v)->locale('fr')->translatedFormat('F Y')) : '—';
@endphp

<div class="entete">
    <table>
        <tr>
            <td>
                <div class="agence">Dalal <span>Immobilier</span></div>
                <div class="slogan">Ici, vous êtes chez vous</div>
                <div style="margin-top:4px;color:#64748b;">
                    {{ $agence->adresse ?? 'Sacré-Cœur 3, Dakar' }}
                    @if(!empty($agence?->telephone)) · {{ $agence->telephone }} @endif
                    @if(!empty($agence?->email)) · {{ $agence->email }} @endif
                </div>
            </td>
            <td class="titre">
                <h1>RELEVÉ DE REVERSEMENT</h1>
                <p><strong>{{ $reversement->numero }}</strong></p>
                <p>Émis le {{ $date($reversement->created_at) }}</p>
            </td>
        </tr>
    </table>
</div>

<table class="bloc">
    <tr>
        <td>
            <div class="label">Propriétaire</div>
            <div style="font-size:13px;font-weight:bold;margin-top:3px;">
                {{ $proprietaire?->prenom }} {{ $proprietaire?->nom }}
            </div>
            <div style="color:#64748b;">{{ $proprietaire?->telephone }} · {{ $proprietaire?->email }}</div>
        </td>
        <td style="text-align:right;">
            <div class="label">Période</div>
            <div style="margin-top:3px;">du {{ $date($reversement->periode_debut) }} au {{ $date($reversement->periode_fin) }}</div>
            <div style="margin-top:6px;">
                @if($reversement->statut === 'paye')
                    <span class="statut paye">PAYÉ le {{ $date($reversement->date_paiement) }}</span>
                @else
                    <span class="statut apayer">À PAYER</span>
                @endif
            </div>
        </td>
    </tr>
</table>

<table class="detail">
    <thead>
        <tr>
            <th>Date</th>
            <th>Bien</th>
            <th>Locataire</th>
            <th>Mois</th>
            <th class="num">Loyer encaissé</th>
            <th class="num">Commission</th>
            <th class="num">Net</th>
        </tr>
    </thead>
    <tbody>
        @foreach($lignes as $l)
            <tr>
                <td>{{ $date($l['date']) }}</td>
                <td>{{ $l['bien'] }}<br><span style="color:#94a3b8;font-size:8.5px;">{{ $l['bail'] }}</span></td>
                <td>{{ $l['locataire'] }}</td>
                <td>{{ $mois($l['mois']) }}</td>
                <td class="num">{{ $fcfa($l['montant']) }}</td>
                <td class="num" style="color:#ff2e5b;">− {{ $fcfa($l['commission']) }}<br><span style="font-size:8.5px;">({{ rtrim(rtrim(number_format($l['taux'], 2, ',', ''), '0'), ',') }} %)</span></td>
                <td class="num"><strong>{{ $fcfa($l['net']) }}</strong></td>
            </tr>
        @endforeach
    </tbody>
</table>

<table class="totaux">
    <tr><td>Total des loyers encaissés</td><td class="num">{{ $fcfa($reversement->montant_brut) }}</td></tr>
    <tr class="com"><td>Commission de l'agence</td><td class="num">− {{ $fcfa($reversement->commission) }}</td></tr>
    <tr class="net"><td>NET À REVERSER</td><td class="num">{{ $fcfa($reversement->montant_net) }}</td></tr>
</table>

@if($reversement->statut === 'paye')
    <p style="margin-top:18px;">
        Montant versé par <strong>{{ $reversement->mode_paiement }}</strong>
        @if($reversement->reference) — référence <strong>{{ $reversement->reference }}</strong> @endif.
    </p>
@endif

<div class="pied">
    Dalal Immobilier — Relevé généré automatiquement le {{ now()->format('d/m/Y à H:i') }}.
    Ce document récapitule les loyers encaissés pour votre compte et la commission de gestion retenue.
</div>

</body>
</html>