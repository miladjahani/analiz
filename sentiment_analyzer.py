
def analyze_sentiment(text):
    """
    A simple keyword-based sentiment analyzer for Persian text.
    """
    positive_keywords = ["عالی", "خوب", "فوق‌العاده", "شگفت‌انگیز", "ممنون", "عشق"]
    negative_keywords = ["بد", "افتضاح", "نفرت", "مشکل", "ضعیف", "متاسفانه"]

    positive_score = 0
    negative_score = 0

    words = text.split()

    for word in words:
        if word in positive_keywords:
            positive_score += 1
        elif word in negative_keywords:
            negative_score += 1

    if positive_score > negative_score:
        return "مثبت"
    elif negative_score > positive_score:
        return "منفی"
    else:
        return "خنثی"

# --- Example Usage ---
comment1 = "این محصول واقعا عالی و با کیفیت است."
comment2 = "متاسفانه تجربه بدی داشتم و مشکل هنوز حل نشده."
comment3 = "این یک کتاب است."

print(f"نظر 1: '{comment1}' -> احساس: {analyze_sentiment(comment1)}")
print(f"نظر 2: '{comment2}' -> احساس: {analyze_sentiment(comment2)}")
print(f"نظر 3: '{comment3}' -> احساس: {analyze_sentiment(comment3)}")
