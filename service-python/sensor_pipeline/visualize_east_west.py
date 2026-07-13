import numpy as np
import matplotlib.pyplot as plt
import sys
import os

# Import the modular pipeline
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from sensor_pipeline import grid_service, airflow_service, thermal_service, clustering_service, allocation_service

def simulate_east_west_thermal(node):
    """
    Simulates a thermal profile for an East-West facing glasshouse.
    Assuming length (Y) is along East-West axis.
    South wall (X=0) gets more sun. East (Y=30) and West (Y=0) get morning/evening sun.
    """
    base_temp = 25.0
    x, y, z = node['x'], node['y'], node['z']
    
    # South wall is hotter (assuming x=0 is South)
    south_exposure = (15.0 - x) * 0.2
    
    # East/West extremes are hotter than center
    # Center is y=15
    end_exposure = abs(y - 15.0) * 0.15
    
    # Heat rises
    z_factor = z * 0.8
    
    return base_temp + south_exposure + end_exposure + z_factor

def generate_maps():
    glasshouse_specs = {"width": 15, "length": 30, "height": 3.0}
    TARGET_ZONES = 6
    
    # 1. Generate Grid
    virtual_grid = grid_service.generate_3d_coordinates(glasshouse_specs, resolution=2.0)
    
    # 2. Airflow & Dead Air
    valid_nodes = []
    dead_nodes = []
    
    for point in virtual_grid:
        air_flow = airflow_service.measure_or_simulate_airflow(point)
        if air_flow >= 0.2:
            valid_nodes.append(point)
        else:
            dead_nodes.append(point)
            
    # 3. Thermal Matrix (East-West profile)
    temperature_matrix = []
    for node in valid_nodes:
        # Override the default thermal service with our East-West simulation
        raw_t = simulate_east_west_thermal(node)
        glass_t = 35.0
        air_v = airflow_service.measure_or_simulate_airflow(node)
        
        corrected_t = thermal_service.calculate_true_temperature(raw_t, glass_t, air_v)
        
        temperature_matrix.append({
            "coordinate": node,
            "temperature": corrected_t
        })
        
    # 4. Clustering (KNN)
    microclimate_clusters = clustering_service.run_clustering_algorithm(data=temperature_matrix, k=TARGET_ZONES)
    
    # 5. Allocation
    final_sensors = []
    for cluster in microclimate_clusters:
        centroid = allocation_service.calculate_spatial_centroid(cluster.nodes)
        if allocation_service.is_dead_air(centroid, airflow_service):
            final_sensors.append(allocation_service.find_nearest_neighbor(centroid, cluster.valid_nodes))
        else:
            final_sensors.append(centroid)
            
    # --- VISUALIZATION (3 MAPS) ---
    fig = plt.figure(figsize=(18, 6))
    
    # MAP 1: Before (Dense Grid)
    ax1 = fig.add_subplot(131, projection='3d')
    ax1.set_title("Map 1: BEFORE KNN\n(Raw Grid & Dead Air)", fontweight='bold')
    # Plot valid nodes
    ax1.scatter([n['x'] for n in valid_nodes], [n['y'] for n in valid_nodes], [n['z'] for n in valid_nodes], 
                c='lightgray', s=10, alpha=0.5, label='Valid Virtual Nodes')
    # Plot dead nodes
    if dead_nodes:
        ax1.scatter([n['x'] for n in dead_nodes], [n['y'] for n in dead_nodes], [n['z'] for n in dead_nodes], 
                    c='red', s=30, marker='x', label='Dead-Air Pockets')
    
    ax1.set_xlim(0, 15); ax1.set_ylim(0, 30); ax1.set_zlim(0, 3)
    ax1.view_init(elev=30, azim=45)
    ax1.legend()
    
    # MAP 2: Thermal Profile (East-West)
    ax2 = fig.add_subplot(132, projection='3d')
    ax2.set_title("Map 2: East-West Thermal Profile\n(Corrected Temperatures)", fontweight='bold')
    xs = [item['coordinate']['x'] for item in temperature_matrix]
    ys = [item['coordinate']['y'] for item in temperature_matrix]
    zs = [item['coordinate']['z'] for item in temperature_matrix]
    temps = [item['temperature'] for item in temperature_matrix]
    
    sc = ax2.scatter(xs, ys, zs, c=temps, cmap='coolwarm', s=20, alpha=0.8)
    plt.colorbar(sc, ax=ax2, shrink=0.5, pad=0.1, label='True Air Temp (°C)')
    ax2.set_xlim(0, 15); ax2.set_ylim(0, 30); ax2.set_zlim(0, 3)
    ax2.view_init(elev=30, azim=45)
    
    # MAP 3: After (KNN Optimization)
    ax3 = fig.add_subplot(133, projection='3d')
    ax3.set_title(f"Map 3: AFTER KNN\n(Final {TARGET_ZONES} Sensor Centroids)", fontweight='bold')
    
    # Plot all valid nodes faded out by cluster color
    colors = ['#FF5733', '#33A1FF', '#33FF57', '#FF33F5', '#F5FF33', '#33FFF5']
    for cluster in microclimate_clusters:
        cx = [n['x'] for n in cluster.nodes]
        cy = [n['y'] for n in cluster.nodes]
        cz = [n['z'] for n in cluster.nodes]
        ax3.scatter(cx, cy, cz, color=colors[cluster.id % len(colors)], s=10, alpha=0.2)
        
    # Plot final sensors
    fx = [s['x'] for s in final_sensors]
    fy = [s['y'] for s in final_sensors]
    fz = [s['z'] for s in final_sensors]
    ax3.scatter(fx, fy, fz, color='black', marker='*', s=300, edgecolor='white', label='Optimal Sensors')
    
    ax3.set_xlim(0, 15); ax3.set_ylim(0, 30); ax3.set_zlim(0, 3)
    ax3.view_init(elev=30, azim=45)
    ax3.legend()
    
    plt.tight_layout()
    
    out_path = r"C:\Users\priya\.gemini\antigravity-ide\brain\8395a02b-10f0-45d4-9cf7-a72480cc237b\east_west_knn_maps.png"
    plt.savefig(out_path, dpi=300)
    print(f"Generated 3 Maps at: {out_path}")

if __name__ == "__main__":
    generate_maps()
