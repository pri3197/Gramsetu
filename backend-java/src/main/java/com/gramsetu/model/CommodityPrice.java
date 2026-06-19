package com.gramsetu.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "commodity_prices")
public class CommodityPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String state;
    private String district;
    private String market;
    private String commodity;
    private String variety;
    private Double minPrice;
    private Double maxPrice;
    private Double modalPrice;
    private String unit;
    private String lastUpdated;

    // Constructors
    public CommodityPrice() {
    }

    public CommodityPrice(Long id, String state, String district, String market, String commodity, String variety, 
                          Double minPrice, Double maxPrice, Double modalPrice, String unit, String lastUpdated) {
        this.id = id;
        this.state = state;
        this.district = district;
        this.market = market;
        this.commodity = commodity;
        this.variety = variety;
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
        this.modalPrice = modalPrice;
        this.unit = unit;
        this.lastUpdated = lastUpdated;
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

    public String getMarket() {
        return market;
    }

    public void setMarket(String market) {
        this.market = market;
    }

    public String getCommodity() {
        return commodity;
    }

    public void setCommodity(String commodity) {
        this.commodity = commodity;
    }

    public String getVariety() {
        return variety;
    }

    public void setVariety(String variety) {
        this.variety = variety;
    }

    public Double getMinPrice() {
        return minPrice;
    }

    public void setMinPrice(Double minPrice) {
        this.minPrice = minPrice;
    }

    public Double getMaxPrice() {
        return maxPrice;
    }

    public void setMaxPrice(Double maxPrice) {
        this.maxPrice = maxPrice;
    }

    public Double getModalPrice() {
        return modalPrice;
    }

    public void setModalPrice(Double modalPrice) {
        this.modalPrice = modalPrice;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public String getLastUpdated() {
        return lastUpdated;
    }

    public void setLastUpdated(String lastUpdated) {
        this.lastUpdated = lastUpdated;
    }
}
