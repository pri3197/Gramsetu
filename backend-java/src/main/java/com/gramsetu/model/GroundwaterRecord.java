package com.gramsetu.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "groundwater_records")
public class GroundwaterRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String state;
    private String district;
    private Double latitude;
    private Double longitude;

    @Column(name = "record_year")
    private Integer year;
    private Double waterTableDepth;
    private Double sewageContamination;
    private Double depletionRate;

    // Constructors
    public GroundwaterRecord() {
    }

    public GroundwaterRecord(Long id, String state, String district, Double latitude, Double longitude,
                             Integer year, Double waterTableDepth, Double sewageContamination, Double depletionRate) {
        this.id = id;
        this.state = state;
        this.district = district;
        this.latitude = latitude;
        this.longitude = longitude;
        this.year = year;
        this.waterTableDepth = waterTableDepth;
        this.sewageContamination = sewageContamination;
        this.depletionRate = depletionRate;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getDistrict() {
        return district;
    }

    public void setDistrict(String district) {
        this.district = district;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Integer getYear() {
        return year;
    }

    public void setYear(Integer year) {
        this.year = year;
    }

    public Double getWaterTableDepth() {
        return waterTableDepth;
    }

    public void setWaterTableDepth(Double waterTableDepth) {
        this.waterTableDepth = waterTableDepth;
    }

    public Double getSewageContamination() {
        return sewageContamination;
    }

    public void setSewageContamination(Double sewageContamination) {
        this.sewageContamination = sewageContamination;
    }

    public Double getDepletionRate() {
        return depletionRate;
    }

    public void setDepletionRate(Double depletionRate) {
        this.depletionRate = depletionRate;
    }
}
