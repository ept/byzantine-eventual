Byzantine Eventual Consistency
==============================

This repository contains materials for the paper
"[Byzantine Eventual Consistency and the Fundamental Limits of Peer-to-Peer Databases](https://arxiv.org/abs/2012.00472)",
by [Martin Kleppmann](https://martin.kleppmann.com/) and [Heidi Howard](http://heidihoward.co.uk/).

LaTeX source
------------

The LaTeX source of the paper is in `byzantine-eventual.tex`, with references in
`references.bib` and figures in the `figs/` subdirectory. To generate the PDF:

    $ pdflatex byzantine-eventual
    $ bibtex byzantine-eventual
    $ pdflatex byzantine-eventual
    $ pdflatex byzantine-eventual

Prototype
---------

The code of our prototype can be found in the `evaluation` directory. It is
written in JavaScript and can be run using [Node.js](https://nodejs.org/).
It consists of the following files:

* `package.json` and `yarn.lock`: Declaration of software dependencies. We use
  the [bloomfilter](https://www.npmjs.com/package/bloomfilter) and
  [mocha](https://www.npmjs.com/package/mocha) (testing framework) packages
  from the Node.js package repository npm.
* `replica.js`: Implementation of our replication algorithms.
* `test.js`: Unit tests to check correctness of the implementation.
* `evaluation.js`: Runs an example workload and prints out statistics.
* `plots.gnuplot`: Generates the plots in the paper.

If you have [Yarn](https://yarnpkg.com/) and [Gnuplot](http://www.gnuplot.info/)
installed, you can reproduce the graphs in the paper as follows:

    $ cd evaluation/
    $ yarn install            # install package dependencies
    $ yarn test               # run unit tests
    $ node evaluation.js > evaluation.data     # takes about 30 sec
    $ gnuplot plots.gnuplot   # plot graphs

License
-------

You may use this code under the terms of the
[MIT License](https://opensource.org/licenses/MIT).
