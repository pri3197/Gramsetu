def set_ventilation_fan_speed(speed):
    """
    Mock function to set ventilation fan speed (0-100%).
    """
    pass

def activate_solenoid_valve(fogger):
    """
    Mock function to turn the high-pressure misting system ON or OFF.
    """
    pass

def control_humidity(current_humidity, target_humidity, fan_speed):
    # Standard threshold rule
    HUMIDITY_BUFFER = 5.0 # Allow a 5% margin
    
    if current_humidity < (target_humidity - HUMIDITY_BUFFER):
        print("WARNING: Humidity Low! Executing adjustments:")
        
        # Action 1: Reduce fan speed to trap existing moisture
        if fan_speed > 20:
            set_ventilation_fan_speed(speed=20)
            print("  -> Throttled ventilation fans down to 20% to retain vapor.")
            
        # Action 2: Activate the active fogging system
        activate_solenoid_valve(fogger=True)
        print("  -> High-pressure misting system ACTIVATED.")
        
    elif current_humidity > (target_humidity + HUMIDITY_BUFFER):
        # Prevent runaway humidity (fungus risk)
        activate_solenoid_valve(fogger=False)
        set_ventilation_fan_speed(speed=80)
        print("  -> Target humidity exceeded. Foggers OFF, fans boosted to purge moisture.")
    else:
        print("Humidity optimal. No action required.")
