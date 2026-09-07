import sys
from PIL import Image

def make_transparent(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        r, g, b, a = item
        # Calculate maximum channel to use as alpha
        v = max(r, g, b)
        
        if v == 0:
            new_data.append((0, 0, 0, 0))
        else:
            # Un-premultiply alpha so the colors stay vibrant when semi-transparent
            new_a = v
            # Add a slight boost to alpha to make it more solid
            new_a = min(255, int(v * 1.2))
            new_r = min(255, int(r * 255 / v))
            new_g = min(255, int(g * 255 / v))
            new_b = min(255, int(b * 255 / v))
            new_data.append((new_r, new_g, new_b, new_a))
            
    img.putdata(new_data)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    make_transparent(sys.argv[1], sys.argv[2])
