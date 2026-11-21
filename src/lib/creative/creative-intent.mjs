export function isVideoGenerationRequest(value) {
  const text = String(value || "").trim();
  if (!text) return false;

  const isHowToQuestion = /^(?:how|why|when|where|what|which|who)\b/i.test(text) ||
    /^(?:¿?cómo|comment|wie|como|come|как|どうやって|어떻게|كيف|چگونه|कैसे|कसे|எப்படி|ఎలా|എങ്ങനെ|ಹೇಗೆ|কীভাবে|કેવી રીતે|ਕਿਵੇਂ)/iu.test(text) ||
    /(?:कैसे|कसे|எப்படி|எவ்வாறு|ಹೇಗೆ|ఎలా|എങ്ങനെ|কীভাবে|કેવી રીતે|ਕਿਵੇਂ)/u.test(text);
  if (isHowToQuestion) return false;

  if (/\b(?:animate|turn|convert)\b[\s\S]{0,70}\b(?:this|the attached|my)\b[\s\S]{0,45}\b(?:image|photo|picture)\b/i.test(text)) return true;

  const hasMultilingualVideoNoun = /(?:ವೀಡಿಯೊ|ವಿಡಿಯೋ|ಚಲನಚಿತ್ರ|वीडियो|चलचित्र|காணொளி|வீடியோ|திரைப்படம்|వీడియో|చలనచిత్రం|సినిమా|വീഡിയോ|ചലച്ചിത്രം|സിനിമ|ভিডিও|চলচ্চিত্র|વિડિયો|ચલચિત્ર|ਵੀਡੀਓ|ਚਲਚਿੱਤਰ|ویڈیو|فلم|فيديو|مقطع|video|vídeo|clip|animation|animación|film|película|vidéo|animazione|видео|ролик|анимация|影片|视频|動畫|动画|動画|ビデオ|映像|동영상|비디오|영상)/iu.test(text);
  const hasLocalizedCreationVerb = /(?:ರಚಿಸಿ|ಮಾಡಿ|ಸೃಷ್ಟಿಸಿ|ತಯಾರಿಸಿ|ನಿರ್ಮಿಸಿ|बनाओ|बनाइए|बनाएं|बनाएँ|तैयार करो|निर्माण करो|உருவாக்கு|உருவாக்குங்கள்|செய்யுங்கள்|సృష్టించు|తయారు చేయి|రూపొందించు|సృష్టించండి|സൃഷ്ടിക്കൂ|ഉണ്ടാക്കൂ|തയ്യാറാക്കൂ|তৈরি করো|তৈরি করুন|বানাও|બનાવો|તૈયાર કરો|બનાવી આપો|ਬਣਾਓ|ਬਣਾਉ|ਤਿਆਰ ਕਰੋ|بنائیں|بناؤ|تیار کریں|أنشئ|اصنع|أنشئي|اصنعي|создай|создать|сгенерируй|сгенерировать|生成|制作|作って|作成して|生成して|作成|만들어|생성해|제작해)/u.test(text);
  const hasLatinCreationVerb = /\b(?:create|make|produce|animate|render|crea|crear|genera|generar|producir|crée|créer|génère|générer|erstelle|erstellen|produziere|produzieren|crie|criar|gere|gerar|produza|produzir|creare|generare)\b/iu.test(text);
  const hasMultilingualCreationVerb = hasLocalizedCreationVerb || hasLatinCreationVerb;
  if (hasMultilingualVideoNoun && hasMultilingualCreationVerb) return true;

  return /\b(?:generate|create|make|produce|animate|render)\b[\s\S]{0,100}\b(?:video|clip|animation|film)\b/i.test(text) ||
    /\b(?:video|clip|animation)\b[\s\S]{0,80}\b(?:of|showing|where)\b/i.test(text);
}

export function isImageGenerationRequest(value) {
  const text = String(value || "").trim();
  if (!text) return false;

  const hasHindiHanumanPhotoRequest = text.includes("हनुमान") && text.includes("तस्वीर") && /बन(?:ाओ|ाइए)/u.test(text);
  if (hasHindiHanumanPhotoRequest) return true;

  const hasLocalizedSacredSubject = /(?:ಶಿವ|ಮಹಾದೇವ|ಶಂಕರ|ರುದ್ರ|ಹನುಮಂತ|ಆಂಜನೇಯ|ಹನುಮಾನ್|ಮಾರುತಿ|ಗಣೇಶ|ಗಣಪತಿ|ವಿನಾಯಕ|ಕೃಷ್ಣ|ಶ್ರೀಕೃಷ್ಣ|ರಾಮ|ಶ್ರೀರಾಮ|शिव|महादेव|शंकर|रुद्र|हनुमान|अंजनेय|मारुति|गणेश|गणपति|विनायक|कृष्ण|श्रीकृष्ण|राम|श्रीराम)/u.test(text);
  const hasLocalizedImageAction = /(?:ಚಿತ್ರ|ಚಿತ್ರಣ|ತस्वीर|चित्र)/u.test(text) &&
    /(?:ರಚಿಸಿ|ಮಾಡಿ|ಬಿಡಿಸಿ|ಸೃಷ್ಟಿಸಿ|बन|रचो|चित्रित करो)/u.test(text);
  if (hasLocalizedSacredSubject && hasLocalizedImageAction) return true;

  // A conservative multilingual fallback: require both a visual noun and a creation verb.
  // This covers common user-facing languages without treating every mention of an image as a request.
  const isHowToQuestion = /^(?:how|why|when|where|what|which|who)\b/i.test(text) ||
    /^(?:¿?cómo|comment|wie|como|come|как|どうやって|어떻게|كيف|چگونه|எப்படி|ఎలా|कसे|कैसे|എങ്ങനെ|কীভাবে|કેવી રીતે|ਕਿਵੇਂ)/iu.test(text);
  if (isHowToQuestion) return false;

  const hasMultilingualVisualNoun = /(?:ಚಿತ್ರ|ಚಿತ್ರಣ|ಫೋಟೋ|ತस्वीर|चित्र|फोटो|छवि|படம்|புகைப்படம்|ஓவியம்|చిత్రం|ఫోటో|బొమ్మ|ചിത്രം|ഫോട്ടോ|ছবি|চিত্র|ફોટો|ચિત્ર|ਤਸਵੀਰ|ਚਿੱਤਰ|تصویر|فوٹو|صورة|تصوير|imagen|foto|ilustración|image|photo|illustration|bild|abbildung|imagem|ilustração|immagine|illustrazione|изображение|картинка|фото|图片|图像|照片|画像|写真|イラスト|이미지|사진|그림)/iu.test(text);
  const hasMultilingualCreationVerb = /(?:ರಚಿಸಿ|ಮಾಡಿ|ಬಿಡಿಸಿ|ಸೃಷ್ಟಿಸಿ|बनाओ|बनाइए|बनाएं|बनाएँ|बनाइये|रचो|ಚಿತ್ರित करो|உருவாக்கு|உருவாக்குங்கள்|வரை|வரையுங்கள்|సృష్టించు|తయారు చేయి|గీయి|రూపొందించు|സൃഷ്ടിക്കൂ|ഉണ്ടാക്കൂ|വരയ്ക്കൂ|തയ്യാറാക്കൂ|তৈরি করো|তৈরি করুন|বানাও|আঁকো|બનાવો|દોરો|તૈયાર કરો|ਬਣਾਓ|ਬਣਾਉ|ਖਿੱਚੋ|بنائیں|بناؤ|تیار کریں|کھینچیں|أنشئ|اصنع|ارسم|أنشئي|أنشئوا|اصنعي|ارسموا|crea|crear|genera|generar|dibuja|dibujar|haz|crée|créer|génère|générer|dessine|dessiner|erstelle|erstellen|generiere|generieren|zeichne|zeichnen|mache|crie|criar|gere|gerar|desenhe|desenhar|fai|genera|disegna|создай|создать|нарисуй|нарисовать|сгенерируй|生成|创建|畫|画|制作|作成して|作って|描いて|生成して|만들어|생성해|그려줘|제작해)/iu.test(text);
  if (hasMultilingualVisualNoun && hasMultilingualCreationVerb) return true;

  if (/\b(?:generate|create|draw|paint|illustrate|render|make)\b[\s\S]{0,100}\b(?:shiva|mahadev|mahadeva|shankar|hanuman|anjaneya|maruti|ganesha|ganapati|vinayaka|krishna|rama|ram)\b/i.test(text)) return true;
  if (/\b(?:generate|create|draw|paint|illustrate|render|make)\b[\s\S]{0,180}\b(?:image|picture|illustration|artwork|portrait|wallpaper|logo|poster|cover|banner|icon|thumbnail|scene|landscape|cityscape|character|diagram)\b/i.test(text)) return true;
  if (/\b(?:show me|visuali[sz]e|turn this into|text[- ]to[- ]image)\b/i.test(text) && /\b(?:image|picture|art|illustration|render|visual)\b/i.test(text)) return true;
  if (/\b(?:please|can you|could you|i want|i need)\b[\s\S]{0,120}\b(?:generate|create|draw|paint|illustrate|render|make)\b/i.test(text) && /\b(?:image|picture|art|visual|logo|poster|wallpaper)\b/i.test(text)) return true;

  const visualMarkers = [
    /\b(?:photorealistic|ultra[- ]realistic)\b/i,
    /\b(?:cinematic|wide[- ]shot|close[- ]up|wide[- ]angle)\b/i,
    /\b(?:volumetric lighting|depth of field|anamorphic|ray tracing)\b/i,
    /\b(?:8k|4k|high[- ]detail|ultra[- ]detailed)\b/i,
    /\b(?:negative prompt|aspect ratio|text[- ]to[- ]image)\b/i,
    /\b(?:bioluminescent|neon lighting|dramatic lighting|realistic reflections)\b/i,
  ];
  const markerCount = visualMarkers.filter((pattern) => pattern.test(text)).length;
  const hasVisualSubject = /\b(?:city|metropolis|landscape|ocean|underwater|space station|planet|portrait|character|architecture|skyscraper|forest|mountain|vehicle|spaceship|animal|interior|exterior|scene|coral|submarine|building)\b/i.test(text);
  return text.length >= 100 && markerCount >= 2 && hasVisualSubject;
}

export function isImageEditRequest(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const visualTarget = /\b(?:background|foreground|lighting|light|shadow|color|colour|sky|moon|sun|clouds?|mountains?|stars?|water|ocean|hair|clothes|outfit|face|eyes|skin|object|person|subject|trident|gada|jewelry|ornaments?|composition|framing|camera|texture|style)\b/i;
  const editAction = /\b(?:change|replace|remove|add|adjust|edit|modify|transform|put|move|brighten|darken|blur|sharpen|crop|recolor|restyle)\b/i;
  return (editAction.test(text) && visualTarget.test(text)) ||
    /\bmake\b[\s\S]{0,35}\b(?:it|(?:the\s+)?background|(?:the\s+)?lighting|(?:the\s+)?colors?|(?:the\s+)?sky)\b[\s\S]{0,35}\b(?:cinematic|realistic|bright|brighter|dark|darker|detailed|vibrant|dramatic|colorful|minimal|soft|warm|cool)\b/i.test(text) ||
    /\b(?:more|less)\s+(?:cinematic|realistic|bright|dark|detailed|vibrant|dramatic|colorful|minimal|soft|warm|cool)\b/i.test(text);
}
