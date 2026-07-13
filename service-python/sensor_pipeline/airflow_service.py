import random

def measure_or_simulate_airflow(point):
    """
    Simulates airflow velocity at a given coordinate.
    Returns velocity in m/s.
    """
    x, y, z = point['x'], point['y'], point['z']
    
    # Simulate dead air pockets near corners (x=0, y=0 or x=width, y=length)
    # Just a simple mock simulation for demonstration
    if (x <= 1.0 or x >= 14.0) and (y <= 1.0 or y >= 29.0):
        # Dead corner
        return random.uniform(0.05, 0.15)
        
    # Standard convection current in the middle
    return random.uniform(0.25, 1.5)
