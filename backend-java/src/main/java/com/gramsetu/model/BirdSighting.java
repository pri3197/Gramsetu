package com.gramsetu.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "bird_sightings")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BirdSighting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String birdId;
    private String name;
    private String scientificName;
    private String status;
    private String description;
    
    private Double latitude;
    private Double longitude;
    
    private LocalDateTime timestamp;
    private Double confidence;
    private Boolean isEndangered;
}
