import sys
from PIL import Image

def remove_bg_smooth(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        r, g, b, a = item
        v = max(r, g, b)
        
        if v < 12:
            new_a = 0
        elif v >= 35:
            new_a = 255
        else:
            new_a = int(((v - 12) / 23.0) * 255)
            
        new_data.append((r, g, b, new_a))
            
    img.putdata(new_data)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    remove_bg_smooth(sys.argv[1], sys.argv[2])
