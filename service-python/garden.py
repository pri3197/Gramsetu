import csv
import math
import sys
import io
import itertools

# Force utf-8 for Windows console
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ==========================================
# 1. DATASET LOADING & PARSING PIPELINE
# ==========================================
def load_dataset(file_path):
    dataset = []
    with open(file_path, mode='r', encoding='utf-8-sig') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            try:
                features = [
                    float(row['N']),
                    float(row['P']),
                    float(row['K']),
                    float(row['pH']),
                    float(row['rainfall']),
                    float(row['temperature'])
                ]
                crop_label = row['Crop'].strip().lower()
                dataset.append((features, crop_label))
            except (ValueError, KeyError):
                continue
    return dataset

# ==========================================
# 2. FEATURE SCALING (Min-Max Normalization)
# ==========================================
def get_min_max(dataset):
    num_features = len(dataset[0][0])
    min_vals = [float('inf')] * num_features
    max_vals = [float('-inf')] * num_features
    for features, _ in dataset:
        for i in range(num_features):
            if features[i] < min_vals[i]: min_vals[i] = features[i]
            if features[i] > max_vals[i]: max_vals[i] = features[i]
    return min_vals, max_vals

def normalize_features(features, min_vals, max_vals):
    return [
        (features[i] - min_vals[i]) / (max_vals[i] - min_vals[i]) 
        if (max_vals[i] - min_vals[i]) != 0 else 0 
        for i in range(len(features))
    ]

# ==========================================
# 3. ADVANCED WEIGHTED DISTANCE ENGINE
# ==========================================
def weighted_euclidean_distance(point1, point2, weights):
    total_squared_distance = 0.0
    for p1, p2, w in zip(point1, point2, weights):
        total_squared_distance += w * ((p1 - p2) ** 2)
    return math.sqrt(total_squared_distance)

# ==========================================
# 4. PREDICTION ENGINE (KNN + Distance-Weighted Votes)
# ==========================================
def predict_crop(train_dataset, min_vals, max_vals, input_features, weights, k=13):
    norm_input = normalize_features(input_features, min_vals, max_vals)
    distances = []
    for train_features, label in train_dataset:
        norm_train = normalize_features(train_features, min_vals, max_vals)
        dist = weighted_euclidean_distance(norm_input, norm_train, weights)
        distances.append((dist, label))
    
    distances.sort(key=lambda x: x[0])
    neighbors = distances[:k]
    
    votes = {}
    for dist, label in neighbors:
        weight = 1.0 / (dist + 1e-5) 
        votes[label] = votes.get(label, 0) + weight
        
    sorted_votes = sorted(votes.items(), key=lambda x: x[1], reverse=True)
    return sorted_votes

# ==========================================
# 5. ECOLOGICAL COMPANION EXTRACTION ENGINE
# ==========================================
# Implements matrix rules R-06, R-15, and R-16 directly into the code logic
def get_ecological_strategy(crop_name):
    crop = crop_name.lower()
    
    # Base structural traits database
    root_types = {
        "carrot": "taproot", "radish": "taproot",
        "corn": "shallow", "onion": "shallow", "lettuce": "shallow", "barley": "shallow", "maize": "shallow"
    }
    
    crop_root = root_types.get(crop, "widespread")
    
    # 📜 Apply Rule R-06: Root Depth Interspersing
    if crop_root == "taproot":
        companion_advice = "Pair with shallow, widespread root systems (e.g., Corn, Onions, Lettuce) to minimize underground space competition."
    elif crop_root == "shallow":
        companion_advice = "Pair with deep taproot crops (e.g., Carrots, Radishes) to effectively utilize different soil layers."
    else:
        companion_advice = "Intersperse with diverse, nitrogen-fixing species to build microbial resilience."

    # 📜 Apply Rule R-16: Pest Spatial Isolation
    spatial_advice = f"Intercrop layout: Keep individual {crop_name.capitalize()} plants as far apart as possible from each other to prevent rapid pest infestation sweeps."
    
    # 📜 Apply Rule R-15: Organic Soil Architecture
    mulch_advice = "Apply woody organic mulch (Arborist wood chips) to boost mycorrhizal fungi, control weeds, and provide safe nesting habits for predatory spiders and beetles."

    return {
        "companion": companion_advice,
        "spatial": spatial_advice,
        "mulch": mulch_advice
    }

# ==========================================
# 6. GREENHOUSE OPTIMIZATION & YIELD PLANNING
# ==========================================

def get_crop_optimal_conditions(crop_name, training_data):
    crop = crop_name.lower()
    
    n_sum, p_sum, k_sum, ph_sum, temp_sum, rain_sum = 0, 0, 0, 0, 0, 0
    count = 0
    
    for features, label in training_data:
        if label == crop:
            n_sum += features[0]
            p_sum += features[1]
            k_sum += features[2]
            ph_sum += features[3]
            rain_sum += features[4]
            temp_sum += features[5]
            count += 1
            
    if count > 0:
        return {
            "N": n_sum / count,
            "P": p_sum / count,
            "K": k_sum / count,
            "pH": ph_sum / count,
            "rainfall": rain_sum / count,
            "temperature": temp_sum / count
        }
        
    return {"N": 50.0, "P": 50.0, "K": 50.0, "pH": 6.5, "rainfall": 1000.0, "temperature": 25.0}

def calculate_plantation(total_beds, bed_length, bed_width, crops):
    # Standard spacing (meters)
    spacing = {
        "tomato": {"l": 0.6, "w": 0.6},
        "cucumber": {"l": 0.5, "w": 0.5}
    }
    
    beds_per_crop = total_beds // len(crops)
    remainder = total_beds % len(crops)
    
    plan = {}
    for i, crop in enumerate(crops):
        crop = crop.lower()
        sp_l = spacing.get(crop, {"l": 0.5})["l"]
        sp_w = spacing.get(crop, {"w": 0.5})["w"]
        
        plants_per_length = int(bed_length // sp_l)
        plants_per_width = int(bed_width // sp_w)
        plants_per_bed = plants_per_length * plants_per_width
        
        assigned_beds = beds_per_crop + (1 if i < remainder else 0)
        total_plants = assigned_beds * plants_per_bed
        
        plan[crop] = {
            "beds": assigned_beds,
            "spacing": f"{sp_l}m x {sp_w}m",
            "plants_per_bed": plants_per_bed,
            "total_plants": total_plants
        }
    return plan

def calculate_yield_and_water(crop_name, num_plants):
    crop = crop_name.lower()
    
    # Defaults
    yield_per_plant = 0
    yield_unit = "fruits"
    water_liters_per_day = 2.0
    
    if crop == "cucumber":
        yield_per_plant = 15 # average of 10 to 20
        water_liters_per_day = 2.5
    elif crop == "tomato":
        yield_per_plant = 25 # determinate average
        water_liters_per_day = 2.0
        
    total_yield = yield_per_plant * num_plants
    total_water = water_liters_per_day * num_plants
    
    return {
        "yield_per_plant": yield_per_plant,
        "total_yield": total_yield,
        "yield_unit": yield_unit,
        "water_per_day": total_water
    }

def render_greenhouse_layout(plan, bed_length, bed_width):
    print("\n" + "="*50)
    print(" 🏡 GREENHOUSE LAYOUT MAP (Top-Down View) ")
    print("="*50)
    
    icons = {"tomato": "🔴", "cucumber": "🥒"}
    
    for crop, data in plan.items():
        icon = icons.get(crop, "🌱")
        beds = data["beds"]
        if beds == 0: continue
        
        print(f"\n[{crop.upper()}] - {beds} Beds ({data['total_plants']} total seeds/plants)")
        # Calculate visual rows (scaling down for console)
        # Assuming 1 character = 0.5m roughly for display purposes
        vis_width = int(bed_width * 2)
        vis_length = int(bed_length * 2)
        
        for b in range(beds):
            print(f" Bed {b+1}:")
            for w in range(vis_width):
                row_str = " ".join([icon] * min(vis_length, 40)) # Cap display width at 40
                if vis_length > 40:
                    row_str += f" ... ({vis_length} total)"
                print(f"  {row_str}")
            print("  " + "🟫 "*min(vis_length, 40)) # Soil/path separator
    print("="*50 + "\n")

# ==========================================
# 7. INTERACTIVE CLI RUNNER
# ==========================================

def run_ml_optimization():
    TRAIN_DATA_PATH = r"D:\Priyanka\Projects\Crop Recommendation dataset\Train Dataset.csv"
    TEST_DATA_PATH = r"D:\Priyanka\Projects\Crop Recommendation dataset\Test Dataset.csv"
    
    try:
        training_data = load_dataset(TRAIN_DATA_PATH)
        testing_data = load_dataset(TEST_DATA_PATH)
        minimums, maximums = get_min_max(training_data)
        
        total_test_cases = len(testing_data)
        OPTIMAL_K = 13
        
        current_weights = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
        feature_names = ["N", "P", "K", "pH", "Rainfall", "Temperature"]
        weight_candidates = [2.0, 2.0, 2.0, 2.0, 2.0, 2.0]
        
        print("\n🚀 Starting Coordinate-Wise Feature Weight Sweep Optimization...")
        
        for f_idx in range(6):
            best_weight_for_feature = 1.0
            best_accuracy_for_feature = 0.0
            
            for weight in weight_candidates:
                test_weights = list(current_weights)
                test_weights[f_idx] = weight
                
                correct_predictions = 0
                for test_features, true_label in testing_data:
                    predictions = predict_crop(training_data, minimums, maximums, test_features, test_weights, k=OPTIMAL_K)
                    if predictions and predictions[0][0] == true_label:
                        correct_predictions += 1
                
                accuracy = (correct_predictions / total_test_cases) * 100
                if accuracy > best_accuracy_for_feature:
                    best_accuracy_for_feature = accuracy
                    best_weight_for_feature = weight
            
            current_weights[f_idx] = best_weight_for_feature
        
        print(f"🏆 Mathematically Tuned Weights Array: {current_weights}\n")
    except FileNotFoundError:
        print("❌ Path Error: Could not resolve source CSV logs.")

def run_greenhouse_planner():
    print("\n🌿 Welcome to the Interactive Greenhouse Planner 🌿")
    TRAIN_DATA_PATH = r"D:\Priyanka\Projects\Crop Recommendation dataset\Train Dataset.csv"
    try:
        training_data = load_dataset(TRAIN_DATA_PATH)
    except Exception as e:
        print(f"❌ Could not load training data: {e}")
        return

    try:
        num_beds = int(input("Enter number of beds (e.g., 5): ") or "5")
        bed_length = float(input("Enter bed length in meters (e.g., 20): ") or "20")
        bed_width = float(input("Enter bed width in meters (e.g., 2): ") or "2")
        crops_input = input("Enter crops to grow, separated by comma (e.g., cucumber, tomato): ") or "cucumber, tomato"
        crops = [c.strip().lower() for c in crops_input.split(",")]
        
        total_area = num_beds * bed_length * bed_width
        print(f"\n--- 📊 GREENHOUSE REPORT (Total Active Area: {total_area} sqm) ---")
        
        plan = calculate_plantation(num_beds, bed_length, bed_width, crops)
        
        for crop, data in plan.items():
            cond = get_crop_optimal_conditions(crop, training_data)
            metrics = calculate_yield_and_water(crop, data["total_plants"])
            
            print(f"\n🌾 Crop: {crop.upper()}")
            print(f"   - Assigned Beds: {data['beds']}")
            print(f"   - Planting Spacing: {data['spacing']}")
            print(f"   - Total Seeds/Plants required: {data['total_plants']} ({data['plants_per_bed']} per bed)")
            print(f"   - Daily Water Needed: {metrics['water_per_day']} Liters")
            print(f"   - Estimated Seasonal Yield: {metrics['total_yield']} {metrics['yield_unit']}")
            print(f"   - Optimal Soil pH: {cond['pH']:.2f}")
            print(f"   - Optimal Temp: {cond['temperature']:.1f}°C")
            print(f"   - Ideal N-P-K: {cond['N']:.0f}-{cond['P']:.0f}-{cond['K']:.0f}")
            
        render_greenhouse_layout(plan, bed_length, bed_width)
            
    except ValueError:
        print("❌ Invalid input. Please enter numbers for dimensions.")

def run_permutation_simulation():
    print("\n🌿 Welcome to the Permutation Combinations Simulation 🌿")
    TRAIN_DATA_PATH = r"D:\Priyanka\Projects\Crop Recommendation dataset\Train Dataset.csv"
    try:
        training_data = load_dataset(TRAIN_DATA_PATH)
    except Exception as e:
        print(f"❌ Could not load training data: {e}")
        return

    configs = [
        {"beds": 5, "length": 20.0, "width": 2.0, "pool": ["cucumber", "tomato", "cabbage", "potato"], "k": 2},
        {"beds": 10, "length": 30.0, "width": 2.0, "pool": ["onion", "garlic", "rice", "sunflower", "papaya"], "k": 3},
        {"beds": 8, "length": 25.0, "width": 2.5, "pool": ["pumpkin", "rapeseed", "cucumber", "tomato", "rice"], "k": 2}
    ]

    for conf in configs:
        num_beds = conf["beds"]
        bed_length = conf["length"]
        bed_width = conf["width"]
        pool = conf["pool"]
        k_val = conf["k"]

        total_area = num_beds * bed_length * bed_width
        print(f"\n=============================================================================================================")
        print(f"--- 🔄 SIMULATING {math.comb(len(pool), k_val)} COMBINATIONS | {num_beds} Beds ({bed_length}m x {bed_width}m) | Total Area: {total_area} sqm ---")
        print(f"=============================================================================================================")
        
        results = []
        for combo in itertools.combinations(pool, k_val):
            combo_list = list(combo)
            plan = calculate_plantation(num_beds, bed_length, bed_width, combo_list)
            
            total_water = 0
            total_yield = 0
            avg_n, avg_p, avg_k, avg_ph = 0, 0, 0, 0
            
            for crop, data in plan.items():
                cond = get_crop_optimal_conditions(crop, training_data)
                metrics = calculate_yield_and_water(crop, data["total_plants"])
                
                total_water += metrics['water_per_day']
                total_yield += metrics['total_yield']  # Assuming comparable units for high-level sorting
                avg_n += cond['N']
                avg_p += cond['P']
                avg_k += cond['K']
                avg_ph += cond['pH']
                
            n_crops = len(combo_list)
            avg_n /= n_crops
            avg_p /= n_crops
            avg_k /= n_crops
            avg_ph /= n_crops
            
            results.append({
                "combo": ", ".join(combo_list),
                "yield": total_yield,
                "water": total_water,
                "N": avg_n, "P": avg_p, "K": avg_k, "pH": avg_ph
            })
            
        # Sort by maximum total yield
        results.sort(key=lambda x: x["yield"], reverse=True)
        
        print(f"\n{'COMBINATION':<30} | {'TOT YIELD (units)':<20} | {'TOT WATER (L/day)':<20} | {'AVG N-P-K':<15} | {'AVG pH'}")
        print("-" * 110)
        for r in results:
            npk = f"{r['N']:.0f}-{r['P']:.0f}-{r['K']:.0f}"
            print(f"{r['combo'].title():<30} | {r['yield']:<20.1f} | {r['water']:<20.1f} | {npk:<15} | {r['pH']:.2f}")

if __name__ == "__main__":
    while True:
        print("\n--- GRAMSETU GARDEN SYSTEM ---")
        print("1. Interactive Greenhouse Planner")
        print("2. Run ML Optimization (KNN Weights)")
        print("3. Run Permutation Combinations Simulation")
        print("4. Exit")
        choice = input("Select an option (1-4): ").strip()
        
        if choice == '1':
            run_greenhouse_planner()
        elif choice == '2':
            run_ml_optimization()
        elif choice == '3':
            run_permutation_simulation()
        elif choice == '4':
            break
        else:
            print("Invalid choice.")