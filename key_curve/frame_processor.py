import cv2
import io
import math
import numpy as np
import statistics

import s3_utils

from PIL import Image

def resize_with_aspect_ratio(image, width=None, height=None, inter=cv2.INTER_AREA):
    dim = None
    (h, w) = image.shape[:2]

    if width is None and height is None:
        return image
    if width is None:
        r = height / float(h)
        dim = (int(w * r), height)
    else:
        r = width / float(w)
        dim = (width, int(h * r))

    return cv2.resize(image, dim, interpolation=inter)


def get_slope_angle_degrees(image):
    '''Returns a slope of all coordinate points (black and near-black pixels) in image in degrees'''
    image = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    image = cv2.flip(image, 0)
    img_height, img_width = image.shape[:2]
    total_pixels = img_height * img_width
    x_coords = []
    y_coords = []
    row_counter = img_height - 1
    black_pixels = 0
    while row_counter > 0:
        for position, pixel in enumerate(image[row_counter, :]):
            if pixel == 0:
                x_coords.append(position)
                y_coords.append(row_counter)
                black_pixels += 1
        row_counter -= 1
    x = np.array(x_coords)
    y = np.array(y_coords)
    slope = (len(x) * np.sum(x * y) - np.sum(x) * np.sum(y)) / (len(x) * np.sum(x * x) - np.sum(x) ** 2)
    # slope, _ = np.polyfit(x, y, 1)
    # slope, _ = np.polyfit(x, y, 1)
    # slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
    # abline(slope, 0)
    # np.polynomial.pol
    # zipped = zip(x,y)
    print("x is:", x)
    print("y is:", y)
    # plt.plot(x, y, 'o')
    # plt.plot(x, slope * x + 1)
    # plt.show()
    slope_angle = math.atan(slope)
    slope_angle_degrees = math.degrees(slope_angle)
    print("Slope:", slope, "Slope angle:", slope_angle, "Slope angle degrees:", slope_angle_degrees)
    print("Black pixel percentage:", black_pixels / total_pixels)
    return slope_angle_degrees


def rotate_image(mat, angle):
    """
    Rotates an image (angle in degrees) and expands image to avoid cropping
    """

    height, width = mat.shape[:2] # image shape has 3 dimensions
    image_center = (width/2, height/2) # getRotationMatrix2D needs coordinates in reverse order (width, height) compared to shape

    rotation_mat = cv2.getRotationMatrix2D(image_center, angle, 1.)

    # rotation calculates the cos and sin, taking absolutes of those.
    abs_cos = abs(rotation_mat[0,0])
    abs_sin = abs(rotation_mat[0,1])

    # find the new width and height bounds
    bound_w = int(height * abs_sin + width * abs_cos)
    bound_h = int(height * abs_cos + width * abs_sin)

    # subtract old image center (bringing image back to origo) and adding the new image center coordinates
    rotation_mat[0, 2] += bound_w/2 - image_center[0]
    rotation_mat[1, 2] += bound_h/2 - image_center[1]

    # rotate image with the new bounds and translated rotation matrix
    rotated_mat = cv2.warpAffine(mat, rotation_mat, (bound_w, bound_h), borderMode=cv2.BORDER_CONSTANT, borderValue=255)
    return rotated_mat


def left_justify_pad_right(image):
    height = image.shape[0]
    image = cv2.bitwise_not(image)
    column_count = 0
    for column in image.T:
       if np.sum(column) == 0:
           column_count += 1
       else:
           break
    left_justified = image[:, column_count:]
    left_justified = cv2.bitwise_not(left_justified)
    # show_image(left_justified, "left justified")
    justified_width = left_justified.shape[1]
    print(f"left_justified {left_justified} and shape {left_justified.ndim}")
    columns_to_add = 300 - justified_width
    append_ones = np.ones((height, columns_to_add), np.uint8)
    append_white = np.full_like(append_ones, 255)
    # show_image(left_justified, "LEFT JUSTIFIED")
    justified_and_appended = np.concatenate((left_justified, append_white), axis=1)

    # show_image(justified_and_appended, "justified and appended")
    # print("New dimensions:", justified_and_appended.shape)
    return justified_and_appended


def get_bounding_rows(img):
    def row_is_white(row):
        # Allow for an off-white pixel or two
        if row.sum() > len(row) * 255 - 100:
            return True
        return False
    upper = 0
    lower = img.shape[0] - 1
    empty_upper = False
    row_count = 0
    quartile = img.shape[0] // 4
    for row in img:
        white_row = row_is_white(row)
        if white_row and row_count < quartile:
            empty_upper = True
            upper += 1
            row_count += 1
            continue
        if white_row and row_count > quartile * 3:
            lower = row_count
            return upper, lower
        row_count += 1
    return upper, lower


def find_first_black_pixel(array):
    return (array < 10).argmax(axis=0)


def get_fin_contour_vector(fin_matrix):
    contours = []
    for row in fin_matrix:
        first_black = find_first_black_pixel(row)
        contours.append(first_black)
    return np.array(contours)


def get_absolute_diff(arr1, arr2):
    return np.absolute(arr1 - arr2)


def show_image(img, window_name="edges"):
    # img = ResizeWithAspectRatio(img, width=1200)
    cv2.imshow(window_name, img)
    cv2.moveWindow(window_name, 500, 0)
    cv2.waitKey()
    cv2.destroyAllWindows()


def get_sorted_contours(contours):
    results = {}
    sorted_contours = sorted(contours, key=lambda c: cv2.arcLength(c, False), reverse=True)
    return sorted_contours


def get_median_contour_length(contours):
    lengths = []
    for contour in contours:
        lengths.append(cv2.arcLength(contour, False))
    return statistics.median(lengths)


def contour_filter(contours):
    median = get_median_contour_length(contours) + 40
    # print("Median contour length is: ", median)
    median_plus_contours = []
    low=10000.0
    high=0
    for contour in contours:
        length = cv2.arcLength(contour, False)
        if length > median + 90:
            median_plus_contours.append(contour)
        # contour_lens.append(length)
        if length < low:
            low = length
        if length > high:
            high = length
    print("Total contours:", len(contours),   "Low: ", low, "High: ", int(high), "Median: ", median)
    return median_plus_contours


def get_contour_img(img, color=True):
    contours, _ = cv2.findContours(img, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = contour_filter(contours)
    contours = get_sorted_contours(contours)
    blank_img = 255 * np.ones(img.shape, dtype=np.uint8)
    if color:
        blank_img = cv2.cvtColor(blank_img, cv2.COLOR_GRAY2RGB)
    return cv2.drawContours(blank_img, contours[:1], -1, (0, 255, 0), 2)


def get_fin_vector(s3_url, rect, thresh, flip):
    '''rect - coordinates of rectangle in [x1,y1,x2,y2] format'''
    local_image_file = s3_utils.download_from_s3(s3_url)
    img = cv2.imread(local_image_file, 0)
    if flip:
        img = cv2.flip(img, 1)
    img = cv2.bitwise_not(img)
    _, thresh = cv2.threshold(img, thresh, 255, 0)
    contour_img = get_contour_img(thresh, color=False)
    fin_rect = contour_img[rect[1]:rect[3], rect[0]:rect[2]]
    image = cv2.convertScaleAbs(fin_rect, alpha=(255.0))
    slope_angle_degrees = get_slope_angle_degrees(image)
    if slope_angle_degrees < 0:
        rotation = abs(slope_angle_degrees)
    else:
        rotation = slope_angle_degrees * -1
    rotated_image = rotate_image(image, rotation)
    _, thresh = cv2.threshold(rotated_image, 200, 255, 0)  # Rotation generates gray pix
    upper, lower = get_bounding_rows(thresh)
    cropped = thresh[upper:lower, 0:thresh.shape[1]]
    rotated_and_resized = resize_with_aspect_ratio(cropped, height=350)
    justified_and_padded = left_justify_pad_right(rotated_and_resized)
    return get_fin_contour_vector(justified_and_padded)


def get_fin_contour_png(s3_url, rect, thresh, flip):
    '''rect - coordinates of rectangle in [x1,y1,x2,y2] format'''
    local_image_file = s3_utils.download_from_s3(s3_url)
    img = cv2.imread(local_image_file, 0)
    if flip:
        img = cv2.flip(img, 1)
    img = cv2.bitwise_not(img)
    _, thresh = cv2.threshold(img, thresh, 255, 0)
    img = get_contour_img(thresh)
    img = img[rect[1]:rect[3], rect[0]:rect[2]]
    img = Image.fromarray(img)
    img = img.convert('RGBA')
    img_data = img.load()
    width, height = img.size
    for y in range(height):
        for x in range(width):
            if img_data[x, y] == (255, 255, 255, 255):
                img_data[x, y] = (0, 255, 255, 0)
    # mem_file = io.BytesIO()
    img.save("/tmp/foo.png", format="PNG")
    return "/tmp/foo.png"
    # return mem_file
