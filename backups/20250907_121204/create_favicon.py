from PIL import Image, ImageDraw, ImageFont

# Create a 16x16 favicon with a distinctive design
favicon = Image.new('RGBA', (16, 16), color=(255, 255, 255, 0))
draw = ImageDraw.Draw(favicon)

# Draw a simple Q shape
draw.polygon([(3, 3), (13, 3), (13, 13), (3, 13)], fill=(0, 128, 255, 255))
draw.polygon([(8, 8), (13, 13), (13, 8)], fill=(255, 255, 255, 255))

# Save the favicon
favicon.save('/Users/hal1/Desktop/CascadeProjects/QubeAgent/static/favicon.ico', format='ICO')
