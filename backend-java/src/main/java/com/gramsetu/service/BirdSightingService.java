package com.gramsetu.service;

import com.gramsetu.model.BirdSighting;
import com.gramsetu.repository.BirdSightingRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

@Service
public class BirdSightingService {

    private static final Logger log = LoggerFactory.getLogger(BirdSightingService.class);

    @Autowired
    private BirdSightingRepository sightingRepository;

    @EventListener(ApplicationReadyEvent.class)
    public void seedInitialSightings() {
        if (sightingRepository.count() > 0) {
            return;
        }
        log.info("Seeding initial bird sightings map data...");
        List<BirdSighting> mockSightings = new ArrayList<>();
        LocalDateTime baseTime = LocalDateTime.now();

        // Forest Owlet (Critically Endangered)
        mockSightings.add(new BirdSighting(null, "forest_owlet", "Forest Owlet", "Athene blewitti", 
            "Critically Endangered", "A small, stocky owl. Endemic to Central India.",
            21.4624, 77.8643, baseTime.minusDays(3), 0.88, true));
        mockSightings.add(new BirdSighting(null, "forest_owlet", "Forest Owlet", "Athene blewitti", 
            "Critically Endangered", "A small, stocky owl. Endemic to Central India.",
            21.7243, 77.2145, baseTime.minusDays(1), 0.91, true));

        // Great Indian Bustard (Critically Endangered)
        mockSightings.add(new BirdSighting(null, "great_indian_bustard", "Great Indian Bustard", "Ardeotis nigriceps", 
            "Critically Endangered", "Large bird, ostrich-like appearance. Heaviest flying bird.",
            26.1245, 71.4243, baseTime.minusDays(10), 0.94, true));
        mockSightings.add(new BirdSighting(null, "great_indian_bustard", "Great Indian Bustard", "Ardeotis nigriceps", 
            "Critically Endangered", "Large bird, ostrich-like appearance. Heaviest flying bird.",
            26.3456, 71.7892, baseTime.minusDays(2), 0.85, true));

        // Jerdon's Courser (Critically Endangered)
        mockSightings.add(new BirdSighting(null, "jerdons_courser", "Jerdon's Courser", "Rhinoptilus bitorquatus", 
            "Critically Endangered", "A nocturnal cursorial bird found only in Andhra Pradesh.",
            14.6543, 78.9843, baseTime.minusDays(12), 0.89, true));

        // Asian Koel (Least Concern)
        mockSightings.add(new BirdSighting(null, "asian_koel", "Asian Koel", "Eudyamys scolopaceus", 
            "Least Concern", "Brood parasite bird. Famous for rising rhythmic koo-oo call.",
            28.6139, 77.2090, baseTime.minusMinutes(45), 0.95, false));
        mockSightings.add(new BirdSighting(null, "asian_koel", "Asian Koel", "Eudyamys scolopaceus", 
            "Least Concern", "Brood parasite bird. Famous for rising rhythmic koo-oo call.",
            19.0760, 72.8777, baseTime.minusHours(5), 0.78, false));

        // Indian Peafowl (Least Concern)
        mockSightings.add(new BirdSighting(null, "indian_peafowl", "Indian Peafowl", "Pavo cristatus", 
            "Least Concern", "National Bird of India. Large, colorful pheasant.",
            27.1751, 78.0421, baseTime.minusDays(4), 0.92, false));

        sightingRepository.saveAll(mockSightings);
        log.info("Successfully seeded {} initial bird sightings.", mockSightings.size());
    }

    public BirdSighting saveSighting(BirdSighting sighting) {
        if (sighting.getTimestamp() == null) {
            sighting.setTimestamp(LocalDateTime.now());
        }
        return sightingRepository.save(sighting);
    }

    public List<BirdSighting> getAllSightings() {
        return sightingRepository.findAll();
    }

    public List<Map<String, Object>> getPopulationSummary() {
        List<Object[]> queryResults = sightingRepository.countSightingsBySpecies();
        List<Map<String, Object>> summary = new ArrayList<>();
        
        for (Object[] row : queryResults) {
            Map<String, Object> map = new HashMap<>();
            map.put("name", row[0]);
            map.put("scientificName", row[1]);
            map.put("status", row[2]);
            map.put("count", row[3]);
            summary.add(map);
        }
        return summary;
    }
}
