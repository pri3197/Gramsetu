package com.gramsetu.repository;

import com.gramsetu.model.CattleOutbreak;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface CattleOutbreakRepository extends JpaRepository<CattleOutbreak, Long> {
    
    List<CattleOutbreak> findByState(String state);
    
    List<CattleOutbreak> findByDisease(String disease);
    
    @Query("SELECT DISTINCT o.state FROM CattleOutbreak o ORDER BY o.state")
    List<String> findDistinctStates();
}
