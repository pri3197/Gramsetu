package com.gramsetu.repository;

import com.gramsetu.model.BioProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BioProductRepository extends JpaRepository<BioProduct, Long> {
}
