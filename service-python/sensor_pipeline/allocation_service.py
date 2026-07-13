import numpy as np
import math

def calculate_spatial_centroid(nodes):
    """Find the mathematical center of the cluster's nodes."""
    avg_x = np.mean([n['x'] for n in nodes])
    avg_y = np.mean([n['y'] for n in nodes])
    avg_z = np.mean([n['z'] for n in nodes])
    
    return {"x": round(avg_x, 2), "y": round(avg_y, 2), "z": round(avg_z, 2)}

def is_dead_air(coord, airflow_service):
    """
    Safety Check: Measure airflow at the centroid to see if it's dead air.
    """
    velocity = airflow_service.measure_or_simulate_airflow(coord)
    return velocity < 0.2

def find_nearest_neighbor(target, valid_nodes):
    """Snaps a dead-air centroid to the closest valid neighboring point."""
    min_dist = float('inf')
    nearest = None
    
    for node in valid_nodes:
        dist = math.sqrt(
            (target['x'] - node['x'])**2 + 
            (target['y'] - node['y'])**2 + 
            (target['z'] - node['z'])**2
        )
        if dist < min_dist:
            min_dist = dist
            nearest = node
            
    return nearest
