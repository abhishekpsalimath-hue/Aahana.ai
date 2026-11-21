import test from "node:test";
import assert from "node:assert/strict";
import { isImageGenerationRequest, isImageEditRequest, isVideoGenerationRequest } from "./creative-intent.mjs";

test("recognizes concise sacred-subject image requests without the word image", () => {
  for (const prompt of [
    "Generate Lord Shiva",
    "Create a beautiful Lord Shiva with the crescent moon",
    "Draw Hanuman",
    "Make a detailed portrait of Lord Ganesha",
    "Please create Krishna",
  ]) assert.equal(isImageGenerationRequest(prompt), true, prompt);
});

test("recognizes explicit image creation requests", () => {
  assert.equal(isImageGenerationRequest("Create a cinematic image of a mountain temple"), true);
  assert.equal(isImageGenerationRequest("Please generate a portrait of my dog"), true);
});

test("does not route ordinary deity questions into image generation", () => {
  assert.equal(isImageGenerationRequest("Explain the story of Lord Shiva"), false);
  assert.equal(isImageGenerationRequest("What are Hanuman's qualities?"), false);
});

test("recognizes image refinement instructions", () => {
  for (const prompt of [
    "Make the background cinematic",
    "Make background cinematic",
    "Make the lighting more dramatic",
    "Change the sky to a starry night",
    "Remove the extra person",
    "Add a trident beside Shiva",
    "Make it more realistic",
  ]) assert.equal(isImageEditRequest(prompt), true, prompt);
});

test("does not mistake unrelated conversation for image editing", () => {
  assert.equal(isImageEditRequest("Help me change my career"), false);
  assert.equal(isImageEditRequest("Explain the background of this story"), false);
});


test("recognizes direct natural-language video creation requests", () => {
  for (const prompt of [
    "Create a video of Lord Shiva meditating on Mount Kailash",
    "Generate a cinematic video of a mountain river",
    "Make a 10-second animation of a flower opening",
    "Produce a short film showing a rainy Bengaluru street",
    "Animate this image into a video",
    "Turn this photo into a video",
  ]) assert.equal(isVideoGenerationRequest(prompt), true, prompt);
});

test("does not route video questions or general explanations into generation", () => {
  for (const prompt of [
    "What is video generation?",
    "How do I make a video?",
    "Explain how animation works",
    "Can you recommend video editing software?",
  ]) assert.equal(isVideoGenerationRequest(prompt), false, prompt);
});

test("recognizes natural-language video creation across major world languages", () => {
  for (const prompt of [
    "ಶಿವನ ಒಂದು ವೀಡಿಯೊ ರಚಿಸಿ",
    "ಈ ಫೋಟೋವನ್ನು ವಿಡಿಯೋ ಆಗಿ ಮಾಡಿ",
    "महादेव का एक वीडियो बनाओ",
    "एक सुंदर मंदिर का वीडियो बनाइए",
    "ஒரு அழகான கோவில் வீடியோ உருவாக்குங்கள்",
    "ఒక అందమైన దేవాలయం వీడియో సృష్టించు",
    "ഒരു മനോഹരമായ ക്ഷേത്രത്തിന്റെ വീഡിയോ ഉണ്ടാക്കൂ",
    "একটি সুন্দর মন্দিরের ভিডিও তৈরি করো",
    "એક સુંદર મંદિરનો વિડિયો બનાવો",
    "ਇੱਕ ਸੁੰਦਰ ਮੰਦਰ ਦੀ ਵੀਡੀਓ ਬਣਾਓ",
    "ایک خوبصورت مندر کی ویڈیو بنائیں",
    "أنشئ فيديو جميلاً لمعبد",
    "Crea un video de un templo hermoso",
    "Crée une vidéo d'un beau temple",
    "Erstelle ein schönes Tempelvideo",
    "Crie um vídeo de um templo bonito",
    "Crea un video di un tempio bellissimo",
    "Создай красивое видео храма",
    "请生成一段美丽寺庙的视频",
    "美しい寺院の動画を作って",
    "美しい寺院の映像を生成して",
    "아름다운 사원의 영상을 만들어",
  ]) assert.equal(isVideoGenerationRequest(prompt), true, prompt);
});

test("does not route multilingual how-to questions about video creation into generation", () => {
  for (const prompt of [
    "How do I make a video?",
    "¿Cómo crear un video?",
    "Comment créer une vidéo ?",
    "Wie erstelle ich ein Video?",
    "Как создать видео?",
    "どうやって動画を作るの？",
    "어떻게 동영상을 만들어?",
    "वीडियो कैसे बनाएं?",
    "வீடியோ எப்படி உருவாக்குவது?",
    "ವೀಡಿಯೊ ಹೇಗೆ ಮಾಡುವುದು?",
    "Un video creativo de un templo hermoso",
    "El reproductor reproduce un video del templo",
    "A video creator explains the process",
  ]) assert.equal(isVideoGenerationRequest(prompt), false, prompt);
});

test("routes Kannada and Hindi sacred image requests directly to generation", () => {
  for (const prompt of [
    "ಶಿವನ ಚಿತ್ರ ರಚಿಸಿ",
    "ಆಂಜನೇಯ ಸ್ವಾಮಿಯ ಚಿತ್ರ ಬಿಡಿಸಿ",
    "ಗಣಪತಿಯ ಚಿತ್ರ ಮಾಡಿ",
    "ಶ್ರೀರಾಮನ ಚಿತ್ರ ಸೃಷ್ಟಿಸಿ",
    "महादेव का चित्र बनाओ",
    "हनुमान की तस्वीर बनाइए",
    "श्रीकृष्ण का चित्र बनाओ",
  ]) assert.equal(isImageGenerationRequest(prompt), true, prompt);
});

test("does not route localized sacred-subject questions into image generation", () => {
  assert.equal(isImageGenerationRequest("ಶಿವನ ಕಥೆ ಹೇಳಿ"), false);
  assert.equal(isImageGenerationRequest("हनुमान कौन हैं?"), false);
});


test("recognizes image creation requests across major world languages", () => {
  for (const prompt of [
    "தமிழில் ஒரு கோவில் படம் உருவாக்குங்கள்",
    "ఒక అందమైన దేవాలయం చిత్రం సృష్టించు",
    "ഒരു മനോഹരമായ ക്ഷേത്ര ചിത്രം വരയ്ക്കൂ",
    "একটি সুন্দর মন্দিরের ছবি তৈরি করো",
    "એક સુંદર મંદિરનું ચિત્ર બનાવો",
    "ਇੱਕ ਸੁੰਦਰ ਮੰਦਰ ਦੀ ਤਸਵੀਰ ਬਣਾਓ",
    "ایک خوبصورت مندر کی تصویر بنائیں",
    "أنشئ صورة جميلة لمعبد",
    "Crea una imagen de un templo hermoso",
    "Crée une belle image d'un temple",
    "Erstelle ein schönes Bild von einem Tempel",
    "Crie uma imagem bonita de um templo",
    "Crea un'immagine di un tempio bellissimo",
    "Создай красивое изображение храма",
    "请生成一张美丽寺庙的图片",
    "美しい寺院の画像を作って",
    "美しい寺院の画像を生成して",
    "아름다운 사원의 이미지를 만들어",
  ]) assert.equal(isImageGenerationRequest(prompt), true, prompt);
});

test("does not route multilingual image questions into generation", () => {
  for (const prompt of [
    "How do I create an image?",
    "Comment créer une image ?",
    "¿Cómo crear una imagen?",
    "Wie erstelle ich ein Bild?",
    "どうやって画像を作るの？",
    "어떻게 이미지를 만들어?",
  ]) assert.equal(isImageGenerationRequest(prompt), false, prompt);
});
