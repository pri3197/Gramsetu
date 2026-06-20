package com.gramsetu.repository;

import com.gramsetu.model.MarineSighting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MarineSightingRepository extends JpaRepository<MarineSighting, Long> {
}
