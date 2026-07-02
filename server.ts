import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON body parser with a large size limit to support image uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Initialize Gemini AI Client lazily to prevent crash if key is missing on startup
  let aiClient: GoogleGenAI | null = null;
  function getAiClient() {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined. Please configure it in Settings > Secrets.");
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return aiClient;
  }

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", hasApiKey: !!process.env.GEMINI_API_KEY });
  });

  // AI Image Enhancer API Route
  app.post("/api/enhance-image", async (req, res) => {
    try {
      const { image, mimeType, modelName, customPrompt } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Nenhuma imagem foi fornecida." });
      }

      const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");

      console.log("Iniciando pipeline de aprimoramento inteligente de 2 estágios...");
      const ai = getAiClient();

      // ESTÁGIO 1: Análise e descrição detalhada da imagem de entrada com o modelo multimodal gemini-2.5-flash
      const analysisPrompt = `
        You are an expert prompt engineer for professional photorealistic image generation.
        Analyze this low-resolution, pixelated, or compressed input image and identify:
        1. The main subject (e.g., gender, age, expression, facial features like a white beard, wrinkles, eyes, hair color).
        2. The clothing (e.g., textures like coarse wool, knitted hood, woven shawl, colors).
        3. The lighting and background (e.g., soft studio lighting, neutral slate background).
        
        Write a highly detailed, gorgeous, professional English prompt to regenerate this EXACT scene in pristine photorealistic HD quality.
        Focus on ultra-realistic details: skin pores, individual sharp beard/hair strands, intricate textile textures, realistic specular lighting in the eyes, high resolution DSLR photography.
        IMPORTANT: Your prompt must tell the model to ignore and omit any pixelation, compression, noise, red measurement lines, scale markings, or visual artifacts present in the original low-res image.
        Output ONLY the raw descriptive prompt. Do NOT include any conversation, markdown, prefix, or extra text.
      `;

      const analysisResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || "image/png"
            }
          },
          {
            text: analysisPrompt
          }
        ]
      });

      const extractedDescription = analysisResponse.text?.trim() || "";
      console.log("Descrição extraída pelo Gemini 2.5 Flash:", extractedDescription);

      if (!extractedDescription) {
        throw new Error("Não foi possível analisar a imagem de entrada.");
      }

      // Combina a descrição extraída com instruções customizadas adicionais, se fornecidas pelo usuário
      let finalPrompt = extractedDescription;
      if (customPrompt && customPrompt.trim()) {
        finalPrompt += `\n\nAdditional user instructions: ${customPrompt.trim()}`;
      }

      // Adiciona sufixos de fotorrealismo de altíssima qualidade
      finalPrompt += ", high resolution portrait, highly detailed, photorealistic, DSLR camera quality, sharp focus, beautiful cinematic lighting, 8k resolution, perfectly clean print quality, no lines or watermarks";

      console.log("Enviando prompt final ao Imagen 3...");

      // ESTÁGIO 2: Geração da imagem impecável em alta definição com o modelo de imagem gemini-3.1-flash-image
      const targetModel = modelName || "gemini-3.1-flash-image";
      console.log(`Enviando prompt final ao modelo ${targetModel}...`);

      const imageResponse = await ai.models.generateContent({
        model: targetModel,
        contents: {
          parts: [
            {
              text: finalPrompt
            }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        }
      });

      let enhancedImageBase64 = "";

      if (imageResponse.candidates && imageResponse.candidates[0]?.content?.parts) {
        for (const part of imageResponse.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            enhancedImageBase64 = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (!enhancedImageBase64) {
        throw new Error(`O modelo ${targetModel} não retornou nenhuma imagem gerada.`);
      }

      res.json({
        success: true,
        image: enhancedImageBase64,
        promptUsed: finalPrompt
      });

    } catch (error: any) {
      console.error("Erro no aprimoramento de imagem:", error);
      let errMsg = error.message || "Erro interno ao processar o aprimoramento com IA.";
      let isQuota = false;
      
      const errorStr = `${error} ${error.stack || ""} ${error.message || ""}`;
      if (
        errorStr.includes("RESOURCE_EXHAUSTED") || 
        errorStr.includes("quota") || 
        errorStr.includes("Quota") || 
        errorStr.includes("429") || 
        errorStr.includes("limit: 0")
      ) {
        isQuota = true;
        errMsg = "A cota gratuita do modelo de imagem (Imagen 3 / Gemini Image) foi excedida ou é limitada a zero nesta conta. Para gerar imagens de alta resolução, acesse o menu de Configurações (ícone de engrenagem no topo direito) para gerenciar seus segredos/chaves de API habilitando o plano com faturamento ativo (Paid Key).";
      }
      
      res.status(500).json({ 
        error: errMsg,
        isQuota: isQuota
      });
    }
  });

  // Serve static files in production / Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
