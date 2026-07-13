import random

def read_raw_sensor_at(node):
    """Mock a raw temperature reading at the node."""
    base_temp = 25.0
    
    # Simulate heat rising
    z_factor = node['z'] * 0.5 
    # Simulate East wall hot zone (if width is 15, x > 10 is east)
    x_factor = 2.0 if node['x'] > 10 else (-1.0 if node['x'] < 5 else 0)
    
    return base_temp + z_factor + x_factor + random.uniform(-0.2, 0.2)

def read_closest_glass_wall_temp(node):
    """Mock the temperature of the physical glass near the sensor."""
    # Glass gets very hot in the sun
    return 35.0

def calculate_true_temperature(raw_reading, glass_temp, air_velocity):
    """
    Apply radiation sensitivity factor to correct the raw thermal reading.
    """
    # Set Radiation Sensitivity Factor based on airflow physics
    if air_velocity < 0.2:
        rsf = 0.45  # Stagnant air amplifies radiation bias
    else:
        rsf = 0.15  # Moving air strips away the bias
        
    # Experimental correction formula
    true_air_temp = raw_reading - (rsf * (raw_reading - glass_temp))
    return true_air_temp
