import sys
from pathlib import Path

from PIL import Image

SIZES = (16, 32, 48, 128)


def main():
    root = Path(__file__).resolve().parent.parent
    source = root / "logo.png"
    output_dir = root / "icons"

    if not source.exists():
        print(f"未找到源图标: {source}")
        return 1

    output_dir.mkdir(exist_ok=True)

    with Image.open(source) as img:
        img = img.convert("RGBA")
        side = min(img.size)
        left = (img.width - side) // 2
        top = (img.height - side) // 2
        square = img.crop((left, top, left + side, top + side))

        for size in SIZES:
            target = output_dir / f"icon{size}.png"
            square.resize((size, size), Image.LANCZOS).save(target)
            print(f"已生成 {target.relative_to(root)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())