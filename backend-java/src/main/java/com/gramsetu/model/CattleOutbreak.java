package com.gramsetu.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "cattle_outbreaks")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CattleOutbreak {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String state;
    private String district;
    private String disease;
    private Double latitude;
    private Double longitude;
    private Integer activeCases;
    private String severity;
    private String transmission;
    private String reportDate;
    
    // Store as comma-separated values (e.g., "Lumpy-Provac, Goat Pox Vaccine")
    private String recommendedVaccines;
}
