/* ============================================================
   device.js — ALPHA Platform · Device Fingerprinting
   Collects browser/device data for anti-fraud purposes.
   Called on boot and sent with initUser.
   ============================================================ */

const DEVICE = (() => {

  // ── Collect all available device info ─────────────────────
  const collect = () => {
    const ua  = navigator.userAgent || "";
    const nav = navigator;

    return {
      // ── Platform ──────────────────────────────────────────
      platform:     _detectPlatform(ua),
      os:           _detectOS(ua),
      browser:      _detectBrowser(ua),
      deviceType:   _detectDeviceType(ua),
      isMobile:     /Mobi|Android|iPhone|iPad/i.test(ua),

      // ── Screen ────────────────────────────────────────────
      screenW:      screen.width,
      screenH:      screen.height,
      colorDepth:   screen.colorDepth,
      pixelRatio:   window.devicePixelRatio || 1,

      // ── Language & Region ─────────────────────────────────
      language:     nav.language || nav.userLanguage || "unknown",
      languages:    nav.languages ? nav.languages.slice(0,3).join(",") : "unknown",
      timezone:     Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
      timezoneOffset: new Date().getTimezoneOffset(),

      // ── Network hints ─────────────────────────────────────
      connectionType: _getConnectionType(),
      online:         nav.onLine,

      // ── Capabilities (help detect bots/emulators) ─────────
      cookiesEnabled: nav.cookieEnabled,
      touchPoints:    nav.maxTouchPoints || 0,
      hardwareConcurrency: nav.hardwareConcurrency || 0,
      deviceMemory:   nav.deviceMemory   || 0,

      // ── Telegram ──────────────────────────────────────────
      tgPlatform:   window.Telegram?.WebApp?.platform || "unknown",
      tgVersion:    window.Telegram?.WebApp?.version  || "unknown",
      tgColorScheme:window.Telegram?.WebApp?.colorScheme || "unknown",

      // ── Timestamp ─────────────────────────────────────────
      collectedAt:  Date.now(),

      // ── Country guess from timezone ───────────────────────
      countryGuess: _countryFromTimezone(),
    };
  };

  // ── Platform detection ────────────────────────────────────
  const _detectPlatform = (ua) => {
    if (/iPhone|iPad|iPod/i.test(ua))  return "iOS";
    if (/Android/i.test(ua))           return "Android";
    if (/Windows/i.test(ua))           return "Windows";
    if (/Mac OS X/i.test(ua))          return "macOS";
    if (/Linux/i.test(ua))             return "Linux";
    return "Unknown";
  };

  const _detectOS = (ua) => {
    const match =
      ua.match(/iPhone OS ([\d_]+)/i)    ||
      ua.match(/Android ([\d.]+)/i)      ||
      ua.match(/Windows NT ([\d.]+)/i)   ||
      ua.match(/Mac OS X ([\d_.]+)/i);
    return match ? match[1].replace(/_/g,".") : "Unknown";
  };

  const _detectBrowser = (ua) => {
    if (/TelegramBot/i.test(ua)) return "Telegram";
    if (/Chrome\/(\d+)/i.test(ua)) {
      const m = ua.match(/Chrome\/(\d+)/i);
      return `Chrome ${m?m[1]:""}`;
    }
    if (/Firefox\/(\d+)/i.test(ua)) {
      const m = ua.match(/Firefox\/(\d+)/i);
      return `Firefox ${m?m[1]:""}`;
    }
    if (/Safari\/(\d+)/i.test(ua) && !/Chrome/i.test(ua)) {
      return "Safari";
    }
    return "Unknown";
  };

  const _detectDeviceType = (ua) => {
    if (/iPad/i.test(ua))            return "Tablet";
    if (/iPhone|iPod/i.test(ua))     return "iPhone";
    if (/Android.*Mobile/i.test(ua)) return "Android Phone";
    if (/Android/i.test(ua))         return "Android Tablet";
    return "Desktop";
  };

  const _getConnectionType = () => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return "unknown";
    return conn.effectiveType || conn.type || "unknown";
  };

  // ── Country from timezone ─────────────────────────────────
  const _countryFromTimezone = () => {
    const tzMap = {
      "Africa/Lagos":          "Nigeria",
      "Africa/Accra":          "Ghana",
      "Africa/Nairobi":        "Kenya",
      "Africa/Johannesburg":   "South Africa",
      "Africa/Cairo":          "Egypt",
      "Africa/Abidjan":        "Côte d'Ivoire",
      "America/New_York":      "United States (EST)",
      "America/Los_Angeles":   "United States (PST)",
      "America/Chicago":       "United States (CST)",
      "America/Sao_Paulo":     "Brazil",
      "America/Mexico_City":   "Mexico",
      "America/Toronto":       "Canada",
      "Europe/London":         "United Kingdom",
      "Europe/Paris":          "France",
      "Europe/Berlin":         "Germany",
      "Europe/Moscow":         "Russia",
      "Europe/Kiev":           "Ukraine",
      "Europe/Istanbul":       "Turkey",
      "Asia/Kolkata":          "India",
      "Asia/Dhaka":            "Bangladesh",
      "Asia/Karachi":          "Pakistan",
      "Asia/Shanghai":         "China",
      "Asia/Tokyo":            "Japan",
      "Asia/Seoul":            "South Korea",
      "Asia/Jakarta":          "Indonesia",
      "Asia/Manila":           "Philippines",
      "Asia/Singapore":        "Singapore",
      "Asia/Dubai":            "UAE",
      "Asia/Tehran":           "Iran",
      "Asia/Baghdad":          "Iraq",
      "Asia/Riyadh":           "Saudi Arabia",
      "Australia/Sydney":      "Australia",
      "Pacific/Auckland":      "New Zealand",
    };

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tzMap[tz]) return tzMap[tz];

    // Fallback — use language
    const langMap = {
      "en-NG":"Nigeria","en-GH":"Ghana","en-KE":"Kenya",
      "en-US":"United States","en-GB":"United Kingdom",
      "fr-FR":"France","de-DE":"Germany","ru-RU":"Russia",
      "pt-BR":"Brazil","es-MX":"Mexico","ar-SA":"Saudi Arabia",
      "hi-IN":"India","zh-CN":"China","ja-JP":"Japan",
      "ko-KR":"South Korea","tr-TR":"Turkey","uk-UA":"Ukraine",
    };
    const lang = navigator.language || "";
    return langMap[lang] || tz?.split("/")?.[0] || "Unknown";
  };

  // ── Scam risk score (0-100, higher = more suspicious) ─────
  const riskScore = (deviceInfo) => {
    let score = 0;

    // Very high touch points on "desktop" = emulator
    if (!deviceInfo.isMobile && deviceInfo.touchPoints > 5) score += 30;

    // No hardware concurrency often means bot/emulator
    if (deviceInfo.hardwareConcurrency === 0) score += 20;
    if (deviceInfo.hardwareConcurrency === 1) score += 10;

    // No device memory reported
    if (deviceInfo.deviceMemory === 0) score += 10;

    // Pixel ratio exactly 1 on "mobile" is suspicious
    if (deviceInfo.isMobile && deviceInfo.pixelRatio === 1) score += 15;

    // Timezone doesn't match language
    const tz  = deviceInfo.timezone || "";
    const lng = deviceInfo.language || "";
    if (tz.includes("Africa") && !lng.startsWith("en") && !lng.startsWith("fr") && !lng.startsWith("ar")) score += 10;

    // Cookies disabled — unusual for real users
    if (!deviceInfo.cookiesEnabled) score += 15;

    return Math.min(score, 100);
  };

  return { collect, riskScore };

})();
