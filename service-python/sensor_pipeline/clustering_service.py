import numpy as np
from sklearn.cluster import KMeans

class Cluster:
    def __init__(self, id, nodes):
        self.id = id
        self.nodes = nodes
        self.valid_nodes = nodes # Handled by allocation later if needed

def run_clustering_algorithm(data, k):
    """
    Groups the thermal matrix into distinct regions using KMeans.
    data: list of dicts with 'coordinate' and 'temperature'
    """
    # Extract features for clustering: X, Y, Z, and Temperature
    features = []
    for item in data:
        coord = item['coordinate']
        # We heavily weight temperature so it clusters strictly by thermal similarity
        # while keeping spatial layout intact.
        features.append([coord['x'], coord['y'], coord['z'], item['temperature'] * 5.0])
        
    features_np = np.array(features)
    
    # Normalize features
    f_mean = features_np.mean(axis=0)
    f_std = features_np.std(axis=0)
    features_norm = np.divide(features_np - f_mean, f_std, out=np.zeros_like(features_np), where=f_std!=0)
    
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(features_norm)
    
    # Group nodes back into Clusters
    clusters = []
    for i in range(k):
        cluster_nodes = [data[idx]['coordinate'] for idx, label in enumerate(labels) if label == i]
        clusters.append(Cluster(id=i, nodes=cluster_nodes))
        
    return clusters
