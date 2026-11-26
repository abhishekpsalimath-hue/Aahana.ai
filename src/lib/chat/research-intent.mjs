const FRESHNESS_PATTERNS = [
  /\b(?:latest|currently|current|today|tonight|yesterday|this week|this month|recent|breaking|news|as of 20\d{2}|right now|live update|search the web|web search|research|find sources|with sources|cite sources|citations|latest price|current price|new rules|recent studies|new research|developments|announcements|breakthroughs|what happened|what'?s new|deep dive|investigate|verify|evidence|academic papers?|peer-reviewed|official documentation|release notes|version history)\b/i,
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2}\b/i,
  /\b20\d{2}[-/](?:0?[1-9]|1[0-2])(?:[-/](?:0?[1-9]|[12]\d|3[01]))?\b/,
];

const REGIONAL_FRESHNESS = /ಇತ್ತೀಚಿನ|ಇಂದು|ಪ್ರಸ್ತುತ|ಸುದ್ದಿ|ಸಂಶೋಧನೆ|ಮೂಲಗಳೊಂದಿಗೆ|ವೆಬ್ ಹುಡುಕು|ಪರಿಶೀಲಿಸಿ|ಮೂಲಗಳು|ತಾಜಾ|ಇತ್ತೀಚಿನ ಮಾಹಿತಿ|ताज़ा|आज|वर्तमान|समाचार|शोध|स्रोतों के साथ|वेब पर खोज|जांचें|साक्ष्य|சமீபத்திய|இன்று|தற்போதைய|செய்தி|ஆராய்ச்சி|மூலங்களுடன்|தேடுங்கள்|తెలంగాణ|తాజా|నేడు|ప్రస్తుత|వార్తలు|పరిశోధన|మూలాలతో|వెతకండి|ഏറ്റവും പുതിയ|ഇന്ന്|നിലവിലെ|വാർത്ത|ഗവേഷണം|ഉറവിടങ്ങൾ|തിരയുക/u;

export function shouldSearchWeb(prompt, image = null) {
  if (image) return false;
  const text = String(prompt || "").trim();
  if (!text) return false;
  return FRESHNESS_PATTERNS.some((pattern) => pattern.test(text)) || REGIONAL_FRESHNESS.test(text);
}
