export default {
  async fetch(request, env) {
    // Gestion CORS pour les requêtes OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Seules les requêtes POST sont autorisées
    if (request.method !== 'POST') {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await request.text();

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: body }] }],
          }),
        }
      );

      // Lire entièrement la réponse texte avant de la renvoyer
      const text = await r.text();

      // Renvoi d'un JSON bien formé au navigateur
      return new Response(text, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};