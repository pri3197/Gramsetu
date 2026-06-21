package com.gramsetu.controller;

import com.gramsetu.model.MarineSighting;
import com.gramsetu.repository.MarineSightingRepository;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/fisheries")
public class FisheriesController {

    private static final Logger log = LoggerFactory.getLogger(FisheriesController.class);

    @Value("${gramsetu.python.service.url}")
    private String pythonServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private MarineSightingRepository sightingRepository;

    @GetMapping("/fish-map")
    public ResponseEntity<?> getFishMapData() {
        log.info("Fetching coastal fish availability map data");
        List<Map<String, Object>> list = new ArrayList<>();

        // Seed fish school coordinates along the Indian coastline
        list.add(createFishSchool("Mackerel", 15.2993, 73.7709, "Goa Coast", 0.85));
        list.add(createFishSchool("Sardines", 11.2588, 75.7804, "Calicut Coast", 0.95));
        list.add(createFishSchool("Tuna", 10.5667, 72.6333, "Lakshadweep Sea", 0.70));
        list.add(createFishSchool("Pomfret", 18.9750, 72.8258, "Mumbai Coast", 0.80));
        list.add(createFishSchool("Hilsa", 21.6266, 87.5074, "Digha Coast (Bay of Bengal)", 0.90));
        list.add(createFishSchool("Sardines", 9.9312, 76.2673, "Kochi Coast", 0.88));
        list.add(createFishSchool("Tuna", 8.4875, 76.9525, "Trivandrum Coast", 0.75));
        list.add(createFishSchool("Mackerel", 13.0827, 80.2707, "Chennai Coast", 0.65));
        list.add(createFishSchool("Pomfret", 17.6868, 83.2185, "Vizag Coast", 0.78));

        return ResponseEntity.ok(list);
    }

    private Map<String, Object> createFishSchool(String species, double lat, double lng, String location, double density) {
        Map<String, Object> map = new HashMap<>();
        map.put("species", species);
        map.put("latitude", lat);
        map.put("longitude", lng);
        map.put("location", location);
        map.put("density", density);
        return map;
    }

    @GetMapping("/reproduction")
    public ResponseEntity<?> getReproductionBans() {
        log.info("Fetching fish reproduction breeding ban data");
        List<Map<String, Object>> list = new ArrayList<>();

        // Hilsa Breeding Ban
        Map<String, Object> hilsa = new HashMap<>();
        hilsa.put("species", "Hilsa (Shad)");
        hilsa.put("season", "September - October (Peak Monsoon Spawn)");
        Map<String, String> hilsaReasons = new HashMap<>();
        hilsaReasons.put("en", "Spawning peak. Harvesting adult egg-bearing Hilsa now decimates next year's crop.");
        hilsaReasons.put("hi", "अंडे देने का समय। इस समय अंडे देने वाली हिल्सा पकड़ने से अगले साल की पैदावार समाप्त हो जाएगी।");
        hilsaReasons.put("ml", "മുട്ടയിടുന്ന സമയം. ഈ സമയത്ത് മുട്ടകളുള്ള ഹിൽസയെ പിടിക്കുന്നത് അടുത്ത വർഷത്തെ വിളവിനെ നശിപ്പിക്കും.");
        hilsaReasons.put("ta", "முட்டையிடும் காலம். இந்த சமயத்தில் முட்டை சுமந்த ஹில்சாவை பிடிப்பது அடுத்த வருட மீன் உற்பத்தியை அழிக்கும்.");
        hilsaReasons.put("bn", "ডিম ছাড়ার সময়। এই সময়ে ডিমওয়ালা ইলিশ ধরলে আগামী বছরের ইলিশের উৎপাদন মারাত্মকভাবে ব্যাহত হবে।");
        hilsa.put("reasons", hilsaReasons);
        list.add(hilsa);

        // Indian Oil Sardines
        Map<String, Object> sardines = new HashMap<>();
        sardines.put("species", "Indian Oil Sardines");
        sardines.put("season", "June - August (Southwest Monsoon)");
        Map<String, String> sardineReasons = new HashMap<>();
        sardineReasons.put("en", "Monsoon spawning. Crucial for restocking coastal biomass.");
        sardineReasons.put("hi", "मानसून प्रजनन। तटीय बायोमास को फिर से भरने के लिए महत्वपूर्ण है।");
        sardineReasons.put("ml", "മൺസൂൺ പ്രജനന കാലം. തീരദേശ മത്സ്യസമ്പത്ത് പുനരുജ്ജീവിപ്പിക്കാൻ ഈ സമയത്ത് ഇവയെ പിടിക്കാതിരിക്കുക.");
        sardineReasons.put("ta", "மழைக்கால இனப்பெருக்கம். கடலோர மீன் வளத்தை மீண்டும் பெருக்க இது மிக முக்கியமானது.");
        sardineReasons.put("bn", "বর্ষাকালীন প্রজনন। উপকূলীয় মাছের মজুদ বৃদ্ধির জন্য এটি অত্যন্ত গুরুত্বপূর্ণ।");
        sardines.put("reasons", sardineReasons);
        list.add(sardines);

        // Pomfret
        Map<String, Object> pomfret = new HashMap<>();
        pomfret.put("species", "Silver Pomfret");
        pomfret.put("season", "October - December (Post-Monsoon Spawn)");
        Map<String, String> pomfretReasons = new HashMap<>();
        pomfretReasons.put("en", "Post-monsoon breeding. Restricting catches helps restore adult stocks.");
        pomfretReasons.put("hi", "मानसून के बाद का प्रजनन। पकड़ने पर प्रतिबंध लगाने से स्टॉक बहाल करने में मदद मिलती है।");
        pomfretReasons.put("ml", "മൺസൂണിന് ശേഷമുള്ള പ്രജനനം. പിടിക്കുന്നത് നിയന്ത്രിക്കുന്നത് മീൻ സമ്പത്ത് നിലനിർത്താൻ സഹായിക്കും.");
        pomfretReasons.put("ta", "மழைக்காலத்திற்கு பிந்தைய இனப்பெருக்கம். இந்த காலத்தில் மீன்பிடிப்பதை கட்டுப்படுத்துவது மீன் வளத்தை காக்க உதவும்.");
        pomfretReasons.put("bn", "বর্ষা পরবর্তী প্রজনন। এই সময় মাছ ধরা বন্ধ রাখলে মাছের সংখ্যা পুনরায় বৃদ্ধি পায়।");
        pomfret.put("reasons", pomfretReasons);
        list.add(pomfret);

        return ResponseEntity.ok(list);
    }

    @GetMapping("/historical-trends")
    public ResponseEntity<?> getHistoricalTrends() {
        log.info("Fetching historical fish census population data");
        List<Map<String, Object>> list = new ArrayList<>();

        // Population count index (arbitrary unit representing ocean biomass index) over years
        list.add(createTrendItem(2016, 85, 70, 95, 80));
        list.add(createTrendItem(2017, 80, 68, 90, 78));
        list.add(createTrendItem(2018, 72, 60, 85, 75));
        list.add(createTrendItem(2019, 60, 52, 70, 68));
        list.add(createTrendItem(2020, 68, 55, 75, 72)); // Restocked during COVID lockdown reductions
        list.add(createTrendItem(2021, 74, 58, 80, 78));
        list.add(createTrendItem(2022, 62, 50, 68, 70));
        list.add(createTrendItem(2023, 55, 45, 60, 65));
        list.add(createTrendItem(2024, 48, 38, 52, 58));
        list.add(createTrendItem(2025, 52, 42, 58, 62)); // Minor recovery due to strict breeding bans
        list.add(createTrendItem(2026, 56, 47, 63, 67));

        return ResponseEntity.ok(list);
    }

    private Map<String, Object> createTrendItem(int year, int sardines, int hilsa, int mackerel, int tuna) {
        Map<String, Object> map = new HashMap<>();
        map.put("year", year);
        map.put("Sardines", sardines);
        map.put("Hilsa", hilsa);
        map.put("Mackerel", mackerel);
        map.put("Tuna", tuna);
        return map;
    }

    @GetMapping("/schemes")
    public ResponseEntity<?> getFisheriesSchemes() {
        log.info("Fetching state fisheries schemes data");
        List<Map<String, Object>> list = new ArrayList<>();

        list.add(createScheme("Central", "PM Matsya Sampada Yojana (PMMSY)", 
            "Subsidies up to 40% (General) & 60% (SC/ST/Women) for modernizing boat engines, deep sea gear, and establishing cold chains."));
        list.add(createScheme("Kerala", "Subsidized Kerosene & Ban Relief", 
            "Provides subsidized kerosene for outboard motors and Rs 4,500 monthly relief during the 52-day monsoon marine fishing ban."));
        list.add(createScheme("Tamil Nadu", "Savings-cum-Relief Scheme", 
            "Fishermen contribute Rs 1,500, state contributes Rs 3,000, disbursing Rs 4,500 total during lean months. Also offers diesel subsidy."));
        list.add(createScheme("Andhra Pradesh", "YSR Matsyakara Bharosa", 
            "Enhanced financial assistance of Rs 10,000 for fishermen families during the marine ban period. Subsidized diesel at Rs 9/litre."));
        list.add(createScheme("Maharashtra", "Fishermen Group Accident Insurance", 
            "Insurance coverage up to Rs 5 Lakhs for active sea-going fishermen. Safety kit subsidies (GPS, lifejackets, wireless transponders)."));
        list.add(createScheme("West Bengal", "Hilsa Conservation Livelihood Support", 
            "Alternative livelihood grants and food rations for fishermen who voluntarily abstain from catching juvenile Hilsa (Jatka)."));

        return ResponseEntity.ok(list);
    }

    private Map<String, Object> createScheme(String state, String title, String description) {
        Map<String, Object> map = new HashMap<>();
        map.put("state", state);
        map.put("title", title);
        map.put("description", description);
        return map;
    }

    @GetMapping("/sightings")
    public ResponseEntity<?> getSightings() {
        log.info("Fetching marine mammal sightings");
        return ResponseEntity.ok(sightingRepository.findAll());
    }

    @PostMapping("/sightings")
    public ResponseEntity<?> uploadSighting(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam("species") String species,
            @RequestParam("latitude") Double latitude,
            @RequestParam("longitude") Double longitude,
            @RequestParam("notes") String notes) {
        
        log.info("Received marine mammal sighting: {} at [{}, {}]", species, latitude, longitude);
        
        String relativeUrl = "";
        
        if (file != null && !file.isEmpty()) {
            try {
                String filename = System.currentTimeMillis() + "_" + file.getOriginalFilename().replaceAll("\\s+", "_");
                byte[] bytes = file.getBytes();
                
                // 1. Write to src static folder for persistence
                File srcDir = new File("src/main/resources/static/uploads/");
                if (!srcDir.exists()) srcDir.mkdirs();
                Files.write(Paths.get(srcDir.getAbsolutePath(), filename), bytes);
                
                // 2. Write to target classes folder for immediate hot serve
                File targetDir = new File("target/classes/static/uploads/");
                if (!targetDir.exists()) targetDir.mkdirs();
                Files.write(Paths.get(targetDir.getAbsolutePath(), filename), bytes);
                
                relativeUrl = "/uploads/" + filename;
                log.info("Saved sighting image to {}", relativeUrl);
            } catch (Exception e) {
                log.error("Failed to save uploaded sighting image: {}", e.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to save file: " + e.getMessage()));
            }
        }
        
        MarineSighting sighting = new MarineSighting();
        sighting.setSpecies(species);
        sighting.setLatitude(latitude);
        sighting.setLongitude(longitude);
        sighting.setTimestamp(LocalDateTime.now());
        sighting.setImageUrl(relativeUrl);
        sighting.setNotes(notes);
        
        MarineSighting saved = sightingRepository.save(sighting);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/imd-warnings")
    public ResponseEntity<?> getImdWarnings() {
        log.info("Fetching live fishermen warnings from Python service: {}/fisheries/imd-warnings", pythonServiceUrl);
        try {
            String url = pythonServiceUrl + "/fisheries/imd-warnings";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("data")) {
                return ResponseEntity.ok(response.get("data"));
            }
        } catch (Exception e) {
            log.error("Could not fetch IMD warnings from Python service: {}", e.getMessage());
        }
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", "IMD service unreachable"));
    }

    @GetMapping("/mangroves/historical")
    public ResponseEntity<?> getHistoricalMangroves() {
        log.info("Fetching FSI historical mangrove cover from Python service: {}/fisheries/mangroves/historical", pythonServiceUrl);
        try {
            String url = pythonServiceUrl + "/fisheries/mangroves/historical";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("data")) {
                return ResponseEntity.ok(response.get("data"));
            }
        } catch (Exception e) {
            log.error("Could not fetch historical mangrove data from Python service: {}", e.getMessage());
        }
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", "Mangrove service unreachable"));
    }
}
