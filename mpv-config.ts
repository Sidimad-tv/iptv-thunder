// Optymalna konfiguracja MPV dla IPTV (live streaming MPEG-TS)
// Wklej do loadUrl() w Player.tsx

const mpvConfig: MpvConfig = {
  initialOptions: {

    // ── Video output ────────────────────────────────────────────────────────
    // gpu-next = nowoczesny renderer (Vulkan/D3D11), lepsza wydajność niż gpu
    'vo': 'gpu-next',

    // ── Hardware decoding ───────────────────────────────────────────────────
    // auto-copy: dekoduje na GPU, kopiuje frame do RAM przed filtrowaniem
    // Bezpieczniejsze niż 'auto' które może crashować z niektórymi sterownikami
    'hwdec': 'auto-copy',

    // ── Live stream tuning ──────────────────────────────────────────────────
    // Minimalne buforowanie dla live TV — zmniejsza opóźnienie
    'cache': 'yes',
    'cache-secs': '10',              // max 10s bufora (nie więcej — live TV)
    'demuxer-readahead-secs': '2',   // czytaj 2s do przodu (nie 5 — to za dużo dla live)
    'demuxer-max-bytes': '50MiB',    // limit pamięci demiksera
    'demuxer-max-back-bytes': '20MiB',

    // Dla live streamów — synchronizacja z serwerem, nie z zegarem lokalnym
    'stream-lavf-o': 'reconnect=1,reconnect_streamed=1,reconnect_delay_max=5',

    // ── Synchronizacja A/V ──────────────────────────────────────────────────
    // audio = priorytet audio (odrzuca/duplikuje klatki żeby trzymać sync)
    // Lepsze dla live TV niż domyślne 'video'
    'video-sync': 'audio',
    'interpolation': 'no',          // wyłącz interpolację klatek — niepotrzebne dla live

    // ── Opóźnienie/latencja ─────────────────────────────────────────────────
    // Dla IPTV ważne żeby nie dopuszczać do dużego driftu
    'vd-lavc-threads': '0',         // auto-detect liczba wątków dekodera
    'vd-lavc-fast': 'yes',          // szybszy dekoder (mniej dokładny ale wystarczający dla TV)

    // ── Sieć ────────────────────────────────────────────────────────────────
    'network-timeout': '10',        // timeout połączenia w sekundach
    'tls-verify': 'no',             // część serwerów IPTV ma self-signed certs

    // ── Okno / embedding ────────────────────────────────────────────────────
    'keep-open': 'yes',             // nie zamykaj po końcu streamu
    // NIE ustawiaj: force-window, fs, border — plugin zarządza oknem

    // ── OSD ─────────────────────────────────────────────────────────────────
    'osd-level': '0',               // wyłącz OSD — mamy własny UI w React
    'osd-bar': 'no',

    // ── Audio ───────────────────────────────────────────────────────────────
    'audio-pitch-correction': 'yes', // korekcja tonu przy zmianie prędkości
    'gapless-audio': 'weak',

  },
  observedProperties: OBSERVED_PROPERTIES,
};
