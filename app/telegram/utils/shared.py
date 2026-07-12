import re
from datetime import datetime

from app.utils.system import readable_size


def get_user_info_text(db_user):
    from app.models.user import UserResponse
    user = UserResponse.model_validate(db_user)
    expire_str = str(user.expire) if user.expire else "Unlimited"
    data_limit = readable_size(user.data_limit) if user.data_limit else "Unlimited"
    used = readable_size(user.used_traffic) if user.used_traffic else "0"

    text = f"<b>User: {user.username}</b>\n"
    text += f"Status: <b>{user.status.value}</b>\n"
    text += f"Data Limit: {data_limit}\n"
    text += f"Used: {used}\n"
    text += f"Expire: {expire_str}\n"

    if user.data_limit and user.used_traffic:
        percent = round((user.used_traffic / user.data_limit) * 100, 1)
        text += f"Usage: {percent}%"

    return text


def get_number_at_end(s):
    match = re.search(r"(\d+)$", s)
    return int(match.group(1)) if match else 0


def get_template_info_text(template):
    return f"<b>Template: {template.name}</b>\nData: {template.data_limit}\nExpire: {template.expire_duration}"


def time_to_string(seconds):
    if not seconds:
        return "Unlimited"
    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    if days > 0:
        return f"{days}d {hours}h"
    return f"{hours}h"


statuses = {s.value: s for s in __import__("app.models.user", fromlist=["UserStatus"]).UserStatus}
