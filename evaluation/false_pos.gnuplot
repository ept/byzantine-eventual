set terminal png size 1100,400
set output 'false_pos.png'
set key left top
set logscale x
set xrange [1:10000]
set style line 1 linewidth 2.5 linecolor rgb '#4472C4'
set style line 2 linewidth 2.5 linecolor rgb '#ED7D31'

set xlabel 'Number of items'
set ylabel 'False positive probability'
plot 'false_pos.data' using 1:2 with lines linestyle 1 title 'Truncated hashes', \
     'false_pos.data' using 1:3 with lines linestyle 2 title 'Bloom filter'
