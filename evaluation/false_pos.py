# Use Python 3 to run this

bits_per_item = 10
hashes = 7

import math

# Probability of collision when each hash is truncated to b bits:
# n = number of items
# b = number of bits per item
#
# P(false positive) =
# P(a given b-bit pattern is among the n items) =
# 1 - P(the given b-bit pattern is different from all of the n hashes) =
# 1 - (1 - 2^-b)^n =
# 1 - (2^b - 1)^n / 2^bn =
# (2^bn - (2^b - 1)^n) / 2^bn

def truncated_hash(bits_per_item, items):
    numerator = 2 ** (bits_per_item * items) - (2**bits_per_item - 1) ** items
    denominator = 2 ** (bits_per_item * items)
    print(f"Truncated hash: {numerator / denominator}")

# Classic Bloom filter false positive probability formula
# (this is not exact, but rather a lower bound):
# k = number of hash functions
# n = number of items
# m = number of bits
#
# kn = number of bit-setting operations, each of which sets one of the m bits to 1
# P(a given bit is 0) = (1 - 1/m)^kn
#
# P(false positive) =
# P(k given bits are all 1) =
# (1 - (1 - 1/m)^kn)^k =
# (1 - (m - 1)^kn / m^kn)^k =
# (m^kn - (m - 1)^kn)^k / m^kkn

def classic_bloom(bits, items, hashes):
    numerator = (bits ** (hashes * items) - (bits - 1) ** (hashes * items)) ** hashes
    denominator = bits ** (hashes * hashes * items)
    print(f"Classic Bloom: {numerator / denominator}")

# Binomial coefficient
# Based on https://jamesmccaffrey.wordpress.com/2020/07/30/computing-a-stirling-number-of-the-second-kind-from-scratch-using-python/
def binomial(n, k):
  if n == k: return 1
  if k < n - k:
    delta = n - k
    i_max = k
  else:
    delta = k
    i_max = n - k

  ans = delta + 1
  for i in range(2, i_max + 1):
    ans = (ans * (delta + i)) // i
  return ans

# Stirling number of the second kind https://en.wikipedia.org/wiki/Stirling_numbers_of_the_second_kind
def stirling(n, k):
    sum = 0
    for i in range(0, k + 1):
        sum += (-1)**(k - i) * binomial(k, i) * i**n
    return sum // math.factorial(k)

# Correct Bloom filter false positive probability, according to
# https://www.sciencedirect.com/science/article/pii/S0020019008001579
def correct_bloom(bits, items, hashes):
    numerator = 0
    for i in range(1, bits + 1):
        numerator += i**hashes * math.factorial(i) * binomial(bits, i) * stirling(hashes * items, i)
    denominator = bits ** (hashes * (items + 1))
    print(f"Correct Bloom: {numerator / denominator}")

for items in [1, 10, 100, 1000, 10000]:
    print(f"With {items} items and {bits_per_item} bits per item:")
    truncated_hash(bits_per_item, items)
    classic_bloom(bits_per_item * items, items, hashes)
    if items <= 100: # it takes about a minute for 100; don't bother for bigger numbers
        correct_bloom(bits_per_item * items, items, hashes)
    print("")

# Output:
#
# With 1 items and 10 bits per item:
# Truncated hash: 0.0009765625
# Classic Bloom: 0.010518744866970362
# Correct Bloom: 0.0174705766201
#
# With 10 items and 10 bits per item:
# Truncated hash: 0.009722821223700424
# Classic Bloom: 0.008394807630049734
# Correct Bloom: 0.008936311594679473
#
# With 100 items and 10 bits per item:
# Truncated hash: 0.09308265650895885
# Classic Bloom: 0.008213554634050216
# Correct Bloom: 0.008266247514843566
#
# With 1000 items and 10 bits per item:
# Truncated hash: 0.623576201943276
# Classic Bloom: 0.008195702596768733
#
# With 10000 items and 10 bits per item:
# Truncated hash: 0.9999428822983674
# Classic Bloom: 0.008193920091727517
