#built using mc-build (https://github.com/mc-build/mc-build)

setblock ~ ~ ~ air
playsound block.metal.break master @a ~ ~ ~
particle block iron_block ~ ~ ~ .5 .5 .5 0 20 force
execute align xyz run summon marker ~.5 ~.5 ~.5 {Tags:["zipline_end"]}