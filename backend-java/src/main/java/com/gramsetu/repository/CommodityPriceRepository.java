package com.gramsetu.repository;

import com.gramsetu.model.CommodityPrice;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface CommodityPriceRepository extends JpaRepository<CommodityPrice, Long> {
    
    List<CommodityPrice> findByState(String state);
    
    List<CommodityPrice> findByCommodity(String commodity);
    
    List<CommodityPrice> findByStateAndDistrict(String state, String district);
    
    @Query("SELECT DISTINCT c.state FROM CommodityPrice c ORDER BY c.state")
    List<String> findDistinctStates();
    
    @Query("SELECT DISTINCT c.commodity FROM CommodityPrice c ORDER BY c.commodity")
    List<String> findDistinctCommodities();
}
