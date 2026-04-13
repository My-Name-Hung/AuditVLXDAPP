import cloudinary
import cloudinary.api
import time

cloudinary.config(
    cloud_name="dn0br7hj0",
    api_key="858213595484572",
    api_secret="DPgIubL29wODRxmV49RoiapTuiI"
)

def delete_all_resources(resource_type):
    print(f"\n===== XÓA {resource_type.upper()} =====")

    next_cursor = None
    total_deleted = 0

    while True:
        # Lấy danh sách resources
        result = cloudinary.api.resources(
            resource_type=resource_type,
            type="upload",
            max_results=500,
            next_cursor=next_cursor
        )

        resources = result.get("resources", [])
        if not resources:
            print(f"✔ Không còn {resource_type} để xóa.")
            break

        public_ids = [r["public_id"] for r in resources]
        print(f"Tìm thấy {len(public_ids)} {resource_type}")

        # Xóa theo batch 100
        for i in range(0, len(public_ids), 100):
            batch = public_ids[i:i+100]
            cloudinary.api.delete_resources(
                batch,
                resource_type=resource_type
            )
            print(f"  → Đã xóa {len(batch)} {resource_type}")
            time.sleep(0.3)

        total_deleted += len(public_ids)

        next_cursor = result.get("next_cursor")
        if not next_cursor:
            break

    print(f"✔ Tổng đã xóa {total_deleted} {resource_type}")


def delete_all_folders():
    print("\n===== XÓA FOLDERS =====")

    folders = cloudinary.api.root_folders().get("folders", [])
    if not folders:
        print("✔ Không có folder nào.")
        return

    for folder in folders:
        name = folder["name"]
        print(f"Đang xóa folder: {name}")
        try:
            cloudinary.api.delete_folder(name)
            print(f"  → Đã xóa folder: {name}")
        except Exception as e:
            print(f"  → Lỗi xóa folder {name}: {e}")


def delete_everything():
    print("\n🚀 BẮT ĐẦU XÓA TOÀN BỘ CLOUDINARY 🚀")

    delete_all_resources("image")   # Xóa tất cả ảnh
    delete_all_resources("video")   # Xóa tất cả video
    delete_all_resources("raw")     # Xóa file raw (pdf, zip,...)
    delete_all_folders()            # Xóa thư mục

    print("\n🎉 ĐÃ XÓA SẠCH CLOUDINARY HOÀN TOÀN 🎉")


delete_everything()