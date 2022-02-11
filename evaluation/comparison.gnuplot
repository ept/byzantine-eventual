# columns:
# 1. number of messages
# 2. git, default alg, kB
# 3. git, default alg, round trips
# 4. git, skipping alg, kB
# 5. git, skipping alg, round trips
# 6. our algorithm 1, kB
# 7. our algorithm 1, round trips
# 8. our algorithm 2, kB
# 9. our algorithm 2, round trips

set terminal postscript eps size 6,2 enhanced color
set output '| ps2pdf -dEPSCrop - comparison.pdf'
set multiplot layout 1,2
set key left top
set logscale

# Colour scheme from https://personal.sron.nl/~pault/data/colourschemes.pdf
set style line 1 linewidth 2.5 linecolor rgb '#0077BB' pointsize 1.3 pointtype 1
set style line 2 linewidth 2.5 linecolor rgb '#009988' pointsize 1.3 pointtype 2
set style line 3 linewidth 2.5 linecolor rgb '#EE7733' pointsize 1.3 pointtype 6
set style line 4 linewidth 2.5 linecolor rgb '#EE3377' pointsize 1.3 pointtype 4

set yrange [0.5:1000]
set xlabel 'Number of messages since last reconciliation'
set ylabel 'Round trips per reconciliation' offset 2,0,0
plot 'comparison.data' using 1:7 with linespoints linestyle 1 title 'OldBlue', \
     'comparison.data' using 1:3 with linespoints linestyle 2 title 'Git (default)', \
     'comparison.data' using 1:5 with linespoints linestyle 3 title 'Git (skipping)', \
     'comparison.data' using 1:9 with linespoints linestyle 4 title 'Our algorithm'

set xlabel 'Number of messages since last reconciliation'
set ylabel 'Protocol overhead [kB]' offset 2,0,0
plot 'comparison.data' using 1:($6-2*$1) with linespoints linestyle 1 title 'OldBlue', \
     'comparison.data' using 1:($2-2*$1) with linespoints linestyle 2 title 'Git (default)', \
     'comparison.data' using 1:($4-2*$1) with linespoints linestyle 3 title 'Git (skipping)', \
     'comparison.data' using 1:($8-2*$1) with linespoints linestyle 4 title 'Our algorithm'
