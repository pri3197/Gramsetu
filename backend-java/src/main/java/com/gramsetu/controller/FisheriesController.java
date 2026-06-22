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
        log.info("Fetching coastal fish availability map data from Python service");
        try {
            String url = pythonServiceUrl + "/fisheries/fish-map";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("data")) {
                return ResponseEntity.ok(response.get("data"));
            }
        } catch (Exception e) {
            log.error("Could not fetch fish map data from Python service: {}", e.getMessage());
        }
        return ResponseEntity.ok(new ArrayList<>());
    }

    @GetMapping("/reproduction")
    public ResponseEntity<?> getReproductionBans() {
        log.info("Fetching fish reproduction breeding ban data from Python service");
        try {
            String url = pythonServiceUrl + "/fisheries/reproduction";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("data")) {
                return ResponseEntity.ok(response.get("data"));
            }
        } catch (Exception e) {
            log.error("Could not fetch reproduction bans from Python service: {}", e.getMessage());
        }
        return ResponseEntity.ok(new ArrayList<>());
    }

    @GetMapping("/historical-trends")
    public ResponseEntity<?> getHistoricalTrends() {
        log.info("Fetching historical fish census population data from Python service");
        try {
            String url = pythonServiceUrl + "/fisheries/trends";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("data")) {
                return ResponseEntity.ok(response.get("data"));
            }
        } catch (Exception e) {
            log.error("Could not fetch historical trends from Python service: {}", e.getMessage());
        }
        return ResponseEntity.ok(new ArrayList<>());
    }

    @GetMapping("/schemes")
    public ResponseEntity<?> getFisheriesSchemes() {
        log.info("Fetching state fisheries schemes data from Python service");
        try {
            String url = pythonServiceUrl + "/fisheries/schemes";
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("data")) {
                return ResponseEntity.ok(response.get("data"));
            }
        } catch (Exception e) {
            log.error("Could not fetch fisheries schemes from Python service: {}", e.getMessage());
        }
        return ResponseEntity.ok(new ArrayList<>());
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
