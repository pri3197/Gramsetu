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

        // No mock sightings to add
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
