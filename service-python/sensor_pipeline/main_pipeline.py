import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sensor_pipeline import grid_service
from sensor_pipeline import airflow_service
from sensor_pipeline import thermal_service
from sensor_pipeline import clustering_service
from sensor_pipeline import allocation_service
from sensor_pipeline import actuator_service

def optimize_sensor_allocation(glasshouse_dimensions, num_target_zones):
    print("Starting Automated Smart Glasshouse Sensor Layout Pipeline...")
    
    # STEP 1: Generate dynamic dense virtual points
    print("   [Step 1] Generating 3D virtual coordinate grid...")
    virtual_grid_points = grid_service.generate_3d_coordinates(glasshouse_dimensions, resolution=2.0)
    valid_nodes = []
    
    # STEP 2: Filter out dead-air pockets
    print(f"   [Step 2] Scanning {len(virtual_grid_points)} nodes for dead-air pockets...")
    for point in virtual_grid_points:
        air_flow = airflow_service.measure_or_simulate_airflow(point)
        
        # Eliminate corners or stagnant zones where convection fails
        if air_flow >= 0.2:  
            valid_nodes.append(point)
            
    print(f"            -> Filtered out {len(virtual_grid_points) - len(valid_nodes)} dead-air nodes.")
            
    # STEP 3: Read data, correct radiation errors, and build Temperature Matrix
    print("   [Step 3] Building Thermal Matrix with Radiation Corrections...")
    temperature_matrix = []
    for node in valid_nodes:
        raw_t = thermal_service.read_raw_sensor_at(node)
        glass_t = thermal_service.read_closest_glass_wall_temp(node)
        air_v = airflow_service.measure_or_simulate_airflow(node)
        
        # Clean the temperature metrics before processing
        corrected_t = thermal_service.calculate_true_temperature(raw_t, glass_t, air_v)
        
        temperature_matrix.append({
            "coordinate": node,
            "temperature": corrected_t
        })
        
    # STEP 4: Group the thermal matrix into distinct regions using KNN/Clustering
    print(f"   [Step 4] Running Clustering Algorithm (Target Zones: {num_target_zones})...")
    microclimate_clusters = clustering_service.run_clustering_algorithm(data=temperature_matrix, k=num_target_zones)
    
    final_sensor_locations = []
    
    # STEP 5: Allocate exactly ONE sensor to the heart of each cluster
    print("   [Step 5] Allocating Sensors to Zone Centroids...")
    for cluster in microclimate_clusters:
        # Find the mathematical center (centroid) of the current microclimate area
        centroid_coord = allocation_service.calculate_spatial_centroid(cluster.nodes)
        
        # Safety Check: If the mathematical center lands on a dead-air pocket, snap it
        if allocation_service.is_dead_air(centroid_coord, airflow_service):
            print(f"            -> Warning: Zone {cluster.id} centroid landed in dead air! Snapping to nearest valid node.")
            allocated_location = allocation_service.find_nearest_neighbor(centroid_coord, cluster.valid_nodes)
        else:
            allocated_location = centroid_coord
            
        final_sensor_locations.append({
            "zone": cluster.id,
            "coords": allocated_location,
            "node_count": len(cluster.nodes)
        })
        
    return final_sensor_locations

if __name__ == "__main__":
    # --- SYSTEM EXECUTION ---
    glasshouse_specs = {"width": 15, "length": 30, "height": 3.0}
    TARGET_ZONES = 6  
    
    hardware_blueprint = optimize_sensor_allocation(glasshouse_specs, TARGET_ZONES)
    
    print("=======================================================")
    print("DEPLOY PHYSICAL SENSORS AT THESE OPTIMAL COORDINATES:")
    print("=======================================================")
    for bp in hardware_blueprint:
        c = bp['coords']
        print(f"ZONE {bp['zone']} (Covers {bp['node_count']} virtual nodes) -> X: {c['x']}m, Y: {c['y']}m, Z: {c['z']}m")
        
    print("\n=======================================================")
    print("TESTING ACTIVE HUMIDITY CONTROL PIPELINE:")
    print("=======================================================")
    # Simulate a scenario where Zone 0 reads very low humidity
    print("[Simulated Sensor Reading from ZONE 0]: Humidity is 50%, Target is 65%")
    actuator_service.control_humidity(current_humidity=50.0, target_humidity=65.0, fan_speed=50)
