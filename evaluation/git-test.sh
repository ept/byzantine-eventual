#!/bin/bash
set -euo pipefail

MESSAGE_SIZE=1000

make_commits () {
    NUM_COMMITS=$1
    for i in $(seq $NUM_COMMITS); do
        head -c"$MESSAGE_SIZE" /dev/urandom > x
        git add x
        git commit -q -m "$i"
        echo -n '.'
    done
    echo ''
}

run_experiment () {
    ALGORITHM=$1
    NUM_COMMITS=$2
    REPEAT=$3
    echo "============================================================="
    echo "Running with $ALGORITHM algorithm, $NUM_COMMITS commits, run #$REPEAT"
    echo ""

    # Make base version common to both branches
    echo 'Making base version'
    rm -rf git1 git2
    mkdir git1
    cd git1
    git init -b main
    git remote add github https://github.com/ept/git-test.git
    make_commits $NUM_COMMITS
    cd ..
    cp -R git1 git2

    # Make the first diverged branch and push it to github
    echo 'Making first branch'
    cd git1
    make_commits $NUM_COMMITS
    git push github main -f
    git push github :main2 || true # delete main2 branch

    # Make the second diverged branch
    echo 'Making second branch'
    cd ../git2
    make_commits $NUM_COMMITS

    # Record the `git fetch` and `git push` traffic
    mitmdump -p 8888 -w ../capture-$ALGORITHM-$NUM_COMMITS-$REPEAT &
    pid=$!
    sleep 5 # give mitmdump a chance to start up
    git -c http.proxy=http://localhost:8888 -c http.sslVerify=false -c fetch.negotiationAlgorithm=$ALGORITHM fetch github
    git -c http.proxy=http://localhost:8888 -c http.sslVerify=false -c fetch.negotiationAlgorithm=$ALGORITHM push github main:main2
    sleep 5
    kill $pid
    cd ..
}

for REPEAT in 3; do
    for NUM_COMMITS in 1000; do # 1 3 10 30 100 300
        # https://git-scm.com/docs/git-config#Documentation/git-config.txt-fetchnegotiationAlgorithm
        # I also tried "-c push.negotiate=true" but it only made things worse
        for ALGORITHM in skipping; do # default 
            run_experiment $ALGORITHM $NUM_COMMITS $REPEAT
        done
    done
done
