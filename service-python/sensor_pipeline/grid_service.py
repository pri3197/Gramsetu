import numpy as np

def generate_3d_coordinates(dimensions, resolution=1.0):
    """
    Generate dense virtual points in the glasshouse.
    resolution: distance between points in meters.
    """
    w, l, h = dimensions["width"], dimensions["length"], dimensions["height"]
    points = []
    
    # Generate points across the 3D space
    for x in np.arange(0, w + resolution, resolution):
        for y in np.arange(0, l + resolution, resolution):
            for z in np.arange(0, h + resolution, resolution):
                points.append({"x": round(x, 1), "y": round(y, 1), "z": round(z, 1)})
                
    return points
