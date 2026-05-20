#built using mc-build (https://github.com/mc-build/mc-build)

tellraw @p {"text":"Maximum number of ziplines reached!","bold":true,"color":"red"}
playsound block.note_block.guitar master @a ~ ~ ~ .5 .5
scoreboard players reset @s lub.rightclick