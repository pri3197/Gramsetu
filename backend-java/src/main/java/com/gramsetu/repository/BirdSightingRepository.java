package com.gramsetu.repository;

import com.gramsetu.model.BirdSighting;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface BirdSightingRepository extends JpaRepository<BirdSighting, Long> {
    
    List<BirdSighting> findByBirdId(String birdId);
    
    List<BirdSighting> findByIsEndangeredTrue();
    
    @Query("SELECT b.name, b.scientificName, b.status, COUNT(b) FROM BirdSighting b GROUP BY b.name, b.scientificName, b.status")
    List<Object[]> countSightingsBySpecies();
}
