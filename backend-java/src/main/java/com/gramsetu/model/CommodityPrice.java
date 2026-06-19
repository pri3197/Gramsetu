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
@Table(name = "commodity_prices")
@Data
@NoArgsConstructor
@AllArgsConstructor
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
}
