# To reproduce the plots, run:
# node evaluation.js > evaluation.data
# gnuplot plots.gnuplot

set terminal postscript eps size 6,2 enhanced color
set output '| ps2pdf -dEPSCrop - plots.pdf'
set multiplot layout 1,2
set key left top
set style line 1 linewidth 2.5 linecolor rgb '#4472C4' pointsize 1.3 pointtype 9
set style line 2 linewidth 2.5 linecolor rgb '#ED7D31' pointsize 1.3 pointtype 2
set style line 3 linewidth 2.5 linecolor rgb '#A5A5A5' pointsize 1.3 pointtype 6


set xlabel 'Number of updates since last reconciliation'
set ylabel 'Average round trips per reconciliation'
plot 'evaluation.data' using 1:5 with linespoints linestyle 1 title 'Algorithm 1', \
     'evaluation.data' using 1:8 with linespoints linestyle 2 title 'Algorithm 2'

set xlabel 'Number of updates since last reconciliation'
set ylabel 'kB transmitted per reconciliation'
plot 'evaluation.data' using 1:3 with linespoints linestyle 1 title 'Algorithm 1', \
     'evaluation.data' using 1:6 with linespoints linestyle 2 title 'Algorithm 2', \
     'evaluation.data' using 1:2 with linespoints linestyle 3 title 'Optimal'
