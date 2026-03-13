import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// 1. Paste your actual API Key here
const API_KEY = "ENTER YOUR API KEY"; 
const genAI = new GoogleGenerativeAI(API_KEY);

let map, markerLayer;

// Initialize Map immediately
function initMap() {
    if (map) return;
    map = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
}
initMap();

window.planTrip = async function() {
    const btn = document.getElementById('btn');
    const itineraryDiv = document.getElementById('itinerary');
    const dest = document.getElementById('dest').value;
    const days = document.getElementById('days').value;
    const interests = document.getElementById('interests').value;

    if (!dest) return alert("Please enter a destination!");
    if (API_KEY === "PASTE_YOUR_KEY_HERE") return alert("Please add your API key to script.js!");

    // UI Loading State
    btn.innerText = "Generating...";
    btn.disabled = true;
    itineraryDiv.innerHTML = `
        <div class="flex items-center justify-center h-full p-10 text-center">
            <div>
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p class="text-indigo-600 font-bold uppercase text-xs tracking-widest">Consulting Gemini 3...</p>
            </div>
        </div>`;

    try {
        // --- THE 2026 FIX ---
        // 'gemini-1.5-flash' is GONE. Use 'gemini-3-flash-preview' or 'gemini-2.5-flash'.
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const prompt = `Generate a ${days}-day travel itinerary for ${dest}. 
        Interests: ${interests}. 
        Return ONLY valid JSON with this exact structure:
        {
          "trip_name": "Trip Name",
          "days": [
            { "day": 1, "activities": [{ "time": "Morning", "place": "Place Name", "desc": "Brief info" }] }
          ]
        }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        // Clean up markdown markers (AI sometimes adds ```json ... ```)
        const text = response.text().replace(/```json|```/g, "").trim();
        const data = JSON.parse(text);

        await renderTrip(data, dest);
    } catch (err) {
        console.error("Critical Error:", err);
        itineraryDiv.innerHTML = `
            <div class="p-6 bg-red-50 text-red-600 rounded-2xl border border-red-200">
                <b class="text-lg">Access Error</b>
                <p class="text-sm mt-2">${err.message}</p>
                <div class="mt-4 text-xs font-mono bg-white p-2 border border-red-100">
                    Troubleshoot: <br>
                    1. Ensure API Key is correct. <br>
                    2. Use 'gemini-2.5-flash' if Gemini 3 is not enabled. <br>
                    3. Run on a Local Server (Live Server).
                </div>
            </div>`;
    } finally {
        btn.innerText = "Generate Itinerary";
        btn.disabled = false;
    }
}

async function renderTrip(data, destination) {
    const container = document.getElementById('itinerary');
    container.innerHTML = `<h2 class="text-3xl font-black text-slate-800 mb-6 leading-tight">${data.trip_name}</h2>`;
    
    markerLayer.clearLayers();
    const bounds = [];

    for (const day of data.days) {
        const dayDiv = document.createElement('div');
        dayDiv.className = "mb-10";
        dayDiv.innerHTML = `<h3 class="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4 border-b pb-2">Day ${day.day}</h3>`;

        for (const act of day.activities) {
            dayDiv.innerHTML += `
                <div class="bg-white p-5 mb-4 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
                    <span class="text-[10px] font-bold text-slate-400 uppercase">${act.time}</span>
                    <h4 class="font-bold text-slate-800 mt-1">${act.place}</h4>
                    <p class="text-sm text-slate-500 leading-relaxed mt-2">${act.desc}</p>
                </div>`;
            
            // Map Logic (OpenStreetMap)
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(act.place + " " + destination)}`);
                const geoData = await geoRes.json();
                if (geoData && geoData[0]) {
                    const pos = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];
                    L.marker(pos).addTo(markerLayer).bindPopup(`<b>${act.place}</b>`);
                    bounds.push(pos);
                }
            } catch (e) { console.warn("Geo fail:", act.place); }
        }
        container.appendChild(dayDiv);
    }

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
}