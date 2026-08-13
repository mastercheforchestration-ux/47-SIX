import fetch from "node-fetch";

const startUrl = process.env.CB_EVENT_URL || "https://eventsapi.chaturbate.com/events/47andsix/DAavfieQYdUKCEiF0iWvcjZJ";

async function poll(url) {
  try {
    const res = await fetch(url);
    const data = await res.json();

    console.log("Events:", data.events);

    if (data.nextUrl) {
      console.log("Next URL:", data.nextUrl);
      // Poll again using the nextUrl
      await poll(data.nextUrl);
    } else {
      console.log("No nextUrl returned — stopping.");
    }
  } catch (err) {
    console.error("Polling error:", err);
  }
}

poll(startUrl);
